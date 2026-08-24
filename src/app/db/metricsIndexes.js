/* eslint-disable no-await-in-loop */
import { INDEX_BUILD_MAINTENANCE_WORK_MEM, INDEX_BUILD_LOCK_TIMEOUT } from '../../config/migration.js';

const METRICS_INDEXES = [
  {
    name: 'translations_created_at_translated_idx',
    definition: 'ON "Translations" ("createdAt") WHERE "translation" IS NOT NULL',
  },
  {
    name: 'reviews_created_at_reviewed_idx',
    definition: 'ON "Reviews" ("createdAt") WHERE "review" IS NOT NULL',
  },
  {
    name: 'reviews_rating_created_at_idx',
    definition: 'ON "Reviews" ("rating", "createdAt")',
  },
];

const INDEX_STATE_QUERY = 'SELECT i.indisvalid AS valid FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid WHERE c.relname = $1';

const MEMORY_SETTING_PATTERN = /^[1-9][0-9]{0,6}(kB|MB|GB)$/;
const DURATION_SETTING_PATTERN = /^[1-9][0-9]{0,6}(ms|s|min)$/;

const buildCreateStatement = (index) => `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${index.name}" ${index.definition}`;

const buildDropStatement = (index) => `DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`;

const resolveSetting = function resolveIndexBuildSetting(value, fallback, pattern) {
  return pattern.test(String(value ?? '')) ? String(value) : fallback;
};

const createMetricsIndexer = function createMetricsIndexRunner({
  query,
  indexes = METRICS_INDEXES,
  log = () => {},
  maintenanceWorkMem = INDEX_BUILD_MAINTENANCE_WORK_MEM,
  lockTimeout = INDEX_BUILD_LOCK_TIMEOUT,
} = {}) {
  const buildMemory = resolveSetting(maintenanceWorkMem, null, MEMORY_SETTING_PATTERN);
  const buildLockTimeout = resolveSetting(
    lockTimeout,
    INDEX_BUILD_LOCK_TIMEOUT,
    DURATION_SETTING_PATTERN,
  );

  const prepareSession = async () => {
    await query('SET statement_timeout = 0');
    await query(`SET lock_timeout = '${buildLockTimeout}'`);

    if (buildMemory !== null) {
      await query(`SET maintenance_work_mem = '${buildMemory}'`);
    }
  };

  const readIndexState = async (index) => {
    const result = await query(INDEX_STATE_QUERY, [index.name]);

    if (result.rows.length === 0) {
      return 'missing';
    }

    return result.rows[0].valid ? 'valid' : 'invalid';
  };

  const create = async function createMetricsIndexes() {
    await prepareSession();

    for (let i = 0; i < indexes.length; i += 1) {
      const index = indexes[i];
      const state = await readIndexState(index);

      if (state === 'valid') {
        log(`${index.name}: already valid, skipping`);
      } else {
        if (state === 'invalid') {
          log(`${index.name}: dropping invalid leftover`);
          await query(buildDropStatement(index));
        }

        log(`${index.name}: building`);
        await query(buildCreateStatement(index));
        log(`${index.name}: done`);
      }
    }
  };

  const drop = async function dropMetricsIndexes() {
    await prepareSession();

    for (let i = 0; i < indexes.length; i += 1) {
      const index = indexes[i];

      log(`${index.name}: dropping`);
      await query(buildDropStatement(index));
    }
  };

  return { create, drop };
};

export default createMetricsIndexer;
export {
  METRICS_INDEXES,
  INDEX_STATE_QUERY,
  buildCreateStatement,
  buildDropStatement,
  resolveSetting,
  MEMORY_SETTING_PATTERN,
  DURATION_SETTING_PATTERN,
};
