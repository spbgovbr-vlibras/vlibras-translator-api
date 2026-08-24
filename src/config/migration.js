export const MIGRATION_ADVISORY_LOCK_KEY = 728193004;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

// Timeout in milliseconds
export const MIGRATION_LOCK_TIMEOUT = parsePositiveInteger(
  process.env.MIGRATION_LOCK_TIMEOUT_MS,
  30 * 1000,
); // 30s
export const MIGRATION_LOCK_POLL_INTERVAL = 500; // 500ms

export const MIGRATION_LOCK_BUSY = 'Another instance holds the migration lock, retrying on the next start';

export const INDEX_BUILD_MAINTENANCE_WORK_MEM = process.env
  .INDEX_BUILD_MAINTENANCE_WORK_MEM || null;
export const INDEX_BUILD_LOCK_TIMEOUT = '10s';
