/* eslint-disable no-await-in-loop */
import createPostgresClient from './postgresClient.js';
import {
  MIGRATION_ADVISORY_LOCK_KEY,
  MIGRATION_LOCK_POLL_INTERVAL,
  MIGRATION_LOCK_TIMEOUT,
} from '../../config/migration.js';

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const createMigrationLock = function createPostgresMigrationLock({
  createClient = createPostgresClient,
  key = MIGRATION_ADVISORY_LOCK_KEY,
  timeout = MIGRATION_LOCK_TIMEOUT,
  pollInterval = MIGRATION_LOCK_POLL_INTERVAL,
  sleep = wait,
  now = Date.now,
} = {}) {
  let client = null;
  let held = false;

  const tryLock = async () => {
    const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [key]);

    return result.rows[0].locked === true;
  };

  const release = async function releaseMigrationLock() {
    if (client === null) {
      return;
    }

    const currentClient = client;
    const wasHeld = held;

    client = null;
    held = false;

    try {
      if (wasHeld) {
        await currentClient.query('SELECT pg_advisory_unlock($1)', [key]);
      }
    } finally {
      await currentClient.end();
    }
  };

  const acquire = async function acquireMigrationLock() {
    client = createClient();

    try {
      await client.connect();

      const deadline = now() + timeout;
      held = await tryLock();

      while (!held && now() < deadline) {
        await sleep(pollInterval);
        held = await tryLock();
      }

      if (!held) {
        await release();
      }

      return held;
    } catch (error) {
      await release().catch(() => {});
      throw error;
    }
  };

  return { acquire, release };
};

export default createMigrationLock;
