import { createRequire } from 'module';
import {
  describe, expect, it, jest,
} from '@jest/globals';

const require = createRequire(import.meta.url);
const migration = require('../../app/db/migrations/20260821140000-metrics-aggregates.cjs');

const CONCURRENT_INDEXES = ['translations_created_at_idx', 'reviews_created_at_idx'];

const createQueryInterface = function createQueryInterface(indexes = {}) {
  const statements = [];

  const query = jest.fn(async (sql, options) => {
    statements.push(sql);

    if (sql.includes('pg_index')) {
      const name = options.bind[0];
      return name in indexes ? [{ indisvalid: indexes[name] }] : [];
    }

    return [];
  });

  return {
    statements,
    query,
    sequelize: { query, QueryTypes: { SELECT: 'SELECT' } },
  };
};

const matching = (queryInterface, fragment) => queryInterface.statements
  .filter((sql) => sql.includes(fragment));

describe('Metrics aggregates migration', () => {
  it('should create both concurrent indexes on a clean database', async () => {
    const queryInterface = createQueryInterface();

    await migration.up(queryInterface);

    expect(matching(queryInterface, 'DROP INDEX CONCURRENTLY')).toHaveLength(0);
    CONCURRENT_INDEXES.forEach((name) => {
      expect(matching(queryInterface, `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name}`)).toHaveLength(1);
    });
  });

  it('should keep a valid index instead of rebuilding it', async () => {
    const queryInterface = createQueryInterface({
      translations_created_at_idx: true,
      reviews_created_at_idx: true,
    });

    await migration.up(queryInterface);

    expect(matching(queryInterface, 'DROP INDEX CONCURRENTLY')).toHaveLength(0);
  });

  it('should drop an invalid index before recreating it', async () => {
    const queryInterface = createQueryInterface({
      translations_created_at_idx: false,
      reviews_created_at_idx: true,
    });

    await migration.up(queryInterface);

    const dropped = matching(queryInterface, 'DROP INDEX CONCURRENTLY');
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toContain('translations_created_at_idx');

    const dropIndex = queryInterface.statements.indexOf(dropped[0]);
    const createIndex = queryInterface.statements
      .findIndex((sql) => sql.includes('CREATE INDEX CONCURRENTLY IF NOT EXISTS translations_created_at_idx'));
    expect(dropIndex).toBeLessThan(createIndex);
  });

  it('should rebuild every invalid index', async () => {
    const queryInterface = createQueryInterface({
      translations_created_at_idx: false,
      reviews_created_at_idx: false,
    });

    await migration.up(queryInterface);

    expect(matching(queryInterface, 'DROP INDEX CONCURRENTLY')).toHaveLength(2);
  });

  it('should look the index up by name, restricted to the visible schema', async () => {
    const queryInterface = createQueryInterface();

    await migration.up(queryInterface);

    const lookups = queryInterface.query.mock.calls.filter(([sql]) => sql.includes('pg_index'));
    expect(lookups.map(([, options]) => options.bind[0])).toEqual(CONCURRENT_INDEXES);
    lookups.forEach(([sql]) => {
      expect(sql).toContain('pg_table_is_visible');
    });
  });

  it('should create the views with no data so the deploy does not scan the tables', async () => {
    const queryInterface = createQueryInterface();

    await migration.up(queryInterface);

    expect(matching(queryInterface, 'CREATE MATERIALIZED VIEW')).toHaveLength(3);
    matching(queryInterface, 'CREATE MATERIALIZED VIEW').forEach((sql) => {
      expect(sql).toContain('WITH NO DATA');
    });
  });

  it('should back every view with the unique index REFRESH CONCURRENTLY needs', async () => {
    const queryInterface = createQueryInterface();

    await migration.up(queryInterface);

    expect(matching(queryInterface, 'CREATE UNIQUE INDEX')).toHaveLength(3);
  });

  it('should drop only what it created', async () => {
    const queryInterface = createQueryInterface();

    await migration.down(queryInterface);

    expect(matching(queryInterface, 'DROP MATERIALIZED VIEW')).toHaveLength(3);
    expect(matching(queryInterface, 'DROP INDEX CONCURRENTLY')).toHaveLength(2);
    expect(matching(queryInterface, 'DROP TABLE')).toHaveLength(0);
  });
});
