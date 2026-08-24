import {
  describe, expect, it, jest,
} from '@jest/globals';

import createMetricsIndexer, {
  METRICS_INDEXES,
  buildCreateStatement,
  buildDropStatement,
  resolveSetting,
  MEMORY_SETTING_PATTERN,
  DURATION_SETTING_PATTERN,
} from '../../app/db/metricsIndexes.js';

const createFakeClient = (states = {}) => {
  const client = {
    executed: [],
    query: jest.fn().mockImplementation((statement, values) => {
      client.executed.push(statement);

      if (statement.startsWith('SELECT i.indisvalid')) {
        const state = states[values[0]];

        if (state === undefined) {
          return Promise.resolve({ rows: [] });
        }

        return Promise.resolve({ rows: [{ valid: state === 'valid' }] });
      }

      return Promise.resolve({ rows: [] });
    }),
  };

  return client;
};

const indexerFor = (client, extra = {}) => createMetricsIndexer({
  query: client.query,
  log: jest.fn(),
  ...extra,
});

const singleIndex = [{
  name: 'translations_created_at_translated_idx',
  definition: 'ON "Translations" ("createdAt") WHERE "translation" IS NOT NULL',
}];

describe('Metrics index statements', () => {
  it('should always build indexes without blocking writes', () => {
    METRICS_INDEXES.forEach((index) => {
      expect(buildCreateStatement(index)).toContain('CREATE INDEX CONCURRENTLY IF NOT EXISTS');
      expect(buildDropStatement(index)).toBe(`DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`);
    });
  });

  it('should cover the three aggregations of the metrics route', () => {
    expect(METRICS_INDEXES.map((index) => index.name)).toEqual([
      'translations_created_at_translated_idx',
      'reviews_created_at_reviewed_idx',
      'reviews_rating_created_at_idx',
    ]);
  });

  it('should keep the translations index partial to the counted rows', () => {
    const [translations] = METRICS_INDEXES;

    expect(buildCreateStatement(translations)).toBe(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "translations_created_at_translated_idx" '
      + 'ON "Translations" ("createdAt") WHERE "translation" IS NOT NULL',
    );
  });
});

describe('Metrics index creation', () => {
  it('should disable the statement timeout and bound the lock wait', async () => {
    const client = createFakeClient();
    const indexer = indexerFor(client, { indexes: singleIndex });

    await indexer.create();

    expect(client.executed[0]).toBe('SET statement_timeout = 0');
    expect(client.executed[1]).toBe("SET lock_timeout = '10s'");
  });

  it('should inherit the server build memory when none is configured', async () => {
    const client = createFakeClient();
    const indexer = indexerFor(client, { indexes: singleIndex, maintenanceWorkMem: undefined });

    await indexer.create();

    expect(client.executed.some((s) => s.includes('maintenance_work_mem'))).toBe(false);
  });

  it('should cap the build memory when a constrained pod requires it', async () => {
    const client = createFakeClient();
    const indexer = indexerFor(client, { indexes: singleIndex, maintenanceWorkMem: '16MB' });

    await indexer.create();

    expect(client.executed[2]).toBe("SET maintenance_work_mem = '16MB'");
  });

  it('should ignore an invalid build memory instead of injecting it', async () => {
    const client = createFakeClient();
    const indexer = indexerFor(client, {
      indexes: singleIndex, maintenanceWorkMem: "1GB'; DROP TABLE x; --",
    });

    await indexer.create();

    expect(client.executed.some((s) => s.includes('maintenance_work_mem'))).toBe(false);
  });

  it('should build an index that does not exist yet', async () => {
    const client = createFakeClient();
    const indexer = indexerFor(client, { indexes: singleIndex });

    await indexer.create();

    expect(client.executed).toContain(buildCreateStatement(singleIndex[0]));
    expect(client.executed).not.toContain(buildDropStatement(singleIndex[0]));
  });

  it('should skip an index that is already valid', async () => {
    const client = createFakeClient({ translations_created_at_translated_idx: 'valid' });
    const indexer = indexerFor(client, { indexes: singleIndex });

    await indexer.create();

    expect(client.executed).not.toContain(buildCreateStatement(singleIndex[0]));
    expect(client.executed).not.toContain(buildDropStatement(singleIndex[0]));
  });

  it('should rebuild an invalid index left behind by an interrupted build', async () => {
    const client = createFakeClient({ translations_created_at_translated_idx: 'invalid' });
    const indexer = indexerFor(client, { indexes: singleIndex });

    await indexer.create();

    const dropAt = client.executed.indexOf(buildDropStatement(singleIndex[0]));
    const createAt = client.executed.indexOf(buildCreateStatement(singleIndex[0]));

    expect(dropAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(dropAt);
  });

  it('should build each index in a separate statement', async () => {
    const client = createFakeClient();
    const indexer = indexerFor(client);

    await indexer.create();

    METRICS_INDEXES.forEach((index) => {
      expect(client.executed).toContain(buildCreateStatement(index));
    });
  });
});

describe('Metrics index rollback', () => {
  it('should drop every index without touching table data', async () => {
    const client = createFakeClient({ translations_created_at_translated_idx: 'valid' });
    const indexer = indexerFor(client);

    await indexer.drop();

    METRICS_INDEXES.forEach((index) => {
      expect(client.executed).toContain(buildDropStatement(index));
    });
    expect(client.executed.some((statement) => /DELETE|DROP TABLE|ALTER TABLE/.test(statement)))
      .toBe(false);
  });
});

describe('Index build settings validation', () => {
  it('should accept well formed memory values', () => {
    expect(resolveSetting('64MB', null, MEMORY_SETTING_PATTERN)).toBe('64MB');
    expect(resolveSetting('512kB', null, MEMORY_SETTING_PATTERN)).toBe('512kB');
    expect(resolveSetting('1GB', null, MEMORY_SETTING_PATTERN)).toBe('1GB');
  });

  it('should reject anything that is not a plain memory value', () => {
    expect(resolveSetting(undefined, null, MEMORY_SETTING_PATTERN)).toBeNull();
    expect(resolveSetting('', null, MEMORY_SETTING_PATTERN)).toBeNull();
    expect(resolveSetting('16', null, MEMORY_SETTING_PATTERN)).toBeNull();
    expect(resolveSetting('0MB', null, MEMORY_SETTING_PATTERN)).toBeNull();
    expect(resolveSetting('10s', null, MEMORY_SETTING_PATTERN)).toBeNull();
    expect(resolveSetting("1MB'; SELECT 1; --", null, MEMORY_SETTING_PATTERN)).toBeNull();
  });

  it('should validate durations separately from memory', () => {
    expect(resolveSetting('30s', '10s', DURATION_SETTING_PATTERN)).toBe('30s');
    expect(resolveSetting('500ms', '10s', DURATION_SETTING_PATTERN)).toBe('500ms');
    expect(resolveSetting('16MB', '10s', DURATION_SETTING_PATTERN)).toBe('10s');
  });
});
