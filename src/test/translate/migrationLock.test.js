import {
  describe, expect, it, jest,
} from '@jest/globals';

import createMigrationLock from '../../app/db/migrationLock.js';
import { MIGRATION_ADVISORY_LOCK_KEY } from '../../config/migration.js';

const createFakeClient = (lockResults) => {
  const remaining = [...lockResults];

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockImplementation((statement) => {
      if (statement.includes('pg_try_advisory_lock')) {
        return Promise.resolve({ rows: [{ locked: remaining.shift() === true }] });
      }

      return Promise.resolve({ rows: [{ pg_advisory_unlock: true }] });
    }),
  };
};

const buildClock = (steps) => {
  const values = [...steps];
  let last = 0;

  return () => {
    last = values.length > 0 ? values.shift() : last;

    return last;
  };
};

describe('Postgres migration lock', () => {
  it('should acquire the lock on the first attempt', async () => {
    const client = createFakeClient([true]);
    const lock = createMigrationLock({ createClient: () => client });

    await expect(lock.acquire()).resolves.toBe(true);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [MIGRATION_ADVISORY_LOCK_KEY],
    );
  });

  it('should keep polling until the other instance releases the lock', async () => {
    const client = createFakeClient([false, false, true]);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const lock = createMigrationLock({
      createClient: () => client,
      sleep,
      pollInterval: 500,
      timeout: 30000,
      now: buildClock([0, 0, 1000, 2000]),
    });

    await expect(lock.acquire()).resolves.toBe(true);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(client.end).not.toHaveBeenCalled();
  });

  it('should give up and close the connection when the timeout expires', async () => {
    const client = createFakeClient([false, false]);
    const lock = createMigrationLock({
      createClient: () => client,
      sleep: jest.fn().mockResolvedValue(undefined),
      timeout: 1000,
      now: buildClock([0, 500, 5000]),
    });

    await expect(lock.acquire()).resolves.toBe(false);
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(client.query).not.toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1)',
      [MIGRATION_ADVISORY_LOCK_KEY],
    );
  });

  it('should not sleep when the timeout is zero', async () => {
    const client = createFakeClient([false]);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const lock = createMigrationLock({
      createClient: () => client,
      sleep,
      timeout: 0,
      now: buildClock([0, 0]),
    });

    await expect(lock.acquire()).resolves.toBe(false);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('should unlock and close the connection on release', async () => {
    const client = createFakeClient([true]);
    const lock = createMigrationLock({ createClient: () => client });

    await lock.acquire();
    await lock.release();

    expect(client.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1)',
      [MIGRATION_ADVISORY_LOCK_KEY],
    );
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it('should be idempotent when released more than once', async () => {
    const client = createFakeClient([true]);
    const lock = createMigrationLock({ createClient: () => client });

    await lock.acquire();
    await lock.release();
    await lock.release();

    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it('should close the connection when the lock query fails', async () => {
    const client = createFakeClient([true]);

    client.query = jest.fn().mockRejectedValue(new Error('connection terminated'));

    const lock = createMigrationLock({ createClient: () => client });

    await expect(lock.acquire()).rejects.toThrow('connection terminated');
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it('should propagate connection failures without leaking the client', async () => {
    const client = createFakeClient([true]);

    client.connect = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const lock = createMigrationLock({ createClient: () => client });

    await expect(lock.acquire()).rejects.toThrow('ECONNREFUSED');
    expect(client.end).toHaveBeenCalledTimes(1);
  });
});
