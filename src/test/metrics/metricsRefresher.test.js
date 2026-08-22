import {
  describe, expect, it, jest,
} from '@jest/globals';

import {
  refreshMetricsViews,
  startMetricsRefresher,
  stopMetricsRefresher,
} from '../../app/metrics/metricsRefresher.js';

const VIEWS = [
  'metrics_translations_daily',
  'metrics_reviews_daily',
  'metrics_hits_top',
];

const LOCK_KEY = 8151974;

const createConnection = function createConnection({ acquired = true, populated = true } = {}) {
  const connection = {
    id: Symbol('connection'),
    statements: [],
    query: jest.fn(async (sql) => {
      connection.statements.push(sql);

      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired }] };
      }
      if (sql.includes('relispopulated')) {
        return { rows: [{ relispopulated: populated }] };
      }
      return { rows: [] };
    }),
  };

  return connection;
};

const createSequelize = function createSequelize(connection) {
  return {
    connectionManager: {
      getConnection: jest.fn(async () => connection),
      releaseConnection: jest.fn(async () => undefined),
    },
  };
};

const refreshStatements = (connection) => connection.statements
  .filter((sql) => sql.startsWith('REFRESH MATERIALIZED VIEW'));

describe('Metrics refresher lock handling', () => {
  it('should take the lock, refresh and release on a single connection', async () => {
    const connection = createConnection();
    const sequelize = createSequelize(connection);

    const executed = await refreshMetricsViews(sequelize);

    expect(executed).toBe(true);
    expect(sequelize.connectionManager.getConnection).toHaveBeenCalledTimes(1);
    // Toda query saiu da mesma conexão: um unlock noutra sessão não solta o lock.
    expect(connection.query.mock.calls.length).toBe(connection.statements.length);
    expect(connection.statements[0]).toContain('pg_try_advisory_lock');
    expect(connection.statements.at(-1)).toContain('pg_advisory_unlock');
  });

  it('should bind the advisory lock and the unlock to the same key', async () => {
    const connection = createConnection();

    await refreshMetricsViews(createSequelize(connection));

    const keyed = connection.query.mock.calls
      .filter(([sql]) => sql.includes('advisory'))
      .map(([, binds]) => binds);

    expect(keyed).toHaveLength(2);
    expect(keyed).toEqual([[LOCK_KEY], [LOCK_KEY]]);
  });

  it('should release the lock before returning the connection to the pool', async () => {
    const connection = createConnection();
    const sequelize = createSequelize(connection);
    let unlockedBeforeRelease = false;

    sequelize.connectionManager.releaseConnection = jest.fn(async () => {
      unlockedBeforeRelease = connection.statements.some((sql) => sql.includes('pg_advisory_unlock'));
    });

    await refreshMetricsViews(sequelize);

    expect(unlockedBeforeRelease).toBe(true);
  });

  it('should refresh every view while holding the lock', async () => {
    const connection = createConnection();

    await refreshMetricsViews(createSequelize(connection));

    const refreshed = refreshStatements(connection);
    expect(refreshed).toHaveLength(VIEWS.length);
    VIEWS.forEach((view, index) => {
      expect(refreshed[index]).toContain(view);
    });
  });

  it('should skip the refresh when another instance holds the lock', async () => {
    const connection = createConnection({ acquired: false });
    const sequelize = createSequelize(connection);

    const executed = await refreshMetricsViews(sequelize);

    expect(executed).toBe(false);
    expect(refreshStatements(connection)).toHaveLength(0);
    expect(sequelize.connectionManager.releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('should not unlock a lock it did not acquire', async () => {
    const connection = createConnection({ acquired: false });

    await refreshMetricsViews(createSequelize(connection));

    expect(connection.statements.some((sql) => sql.includes('pg_advisory_unlock'))).toBe(false);
  });

  it('should release the lock and the connection when a refresh fails', async () => {
    const connection = createConnection();
    const sequelize = createSequelize(connection);

    connection.query.mockImplementation(async (sql) => {
      connection.statements.push(sql);

      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired: true }] };
      }
      if (sql.includes('relispopulated')) {
        return { rows: [{ relispopulated: true }] };
      }
      if (sql.startsWith('REFRESH MATERIALIZED VIEW')) {
        throw new Error('deadlock detected');
      }
      return { rows: [] };
    });

    const executed = await refreshMetricsViews(sequelize);

    expect(executed).toBe(false);
    expect(connection.statements.some((sql) => sql.includes('pg_advisory_unlock'))).toBe(true);
    expect(sequelize.connectionManager.releaseConnection).toHaveBeenCalledWith(connection);
  });

  it('should not leave the refresher blocked after a failure', async () => {
    const failing = createConnection();
    failing.query.mockRejectedValue(new Error('connection terminated'));

    await refreshMetricsViews(createSequelize(failing));

    const healthy = createConnection();
    await expect(refreshMetricsViews(createSequelize(healthy))).resolves.toBe(true);
  });

  it('should swallow an unlock failure and still report the refresh', async () => {
    const connection = createConnection();
    const sequelize = createSequelize(connection);

    connection.query.mockImplementation(async (sql) => {
      connection.statements.push(sql);

      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ acquired: true }] };
      }
      if (sql.includes('pg_advisory_unlock')) {
        throw new Error('server closed the connection unexpectedly');
      }
      if (sql.includes('relispopulated')) {
        return { rows: [{ relispopulated: true }] };
      }
      return { rows: [] };
    });

    await expect(refreshMetricsViews(sequelize)).resolves.toBe(true);
    expect(sequelize.connectionManager.releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('should not run two cycles at the same time', async () => {
    const connection = createConnection();
    const sequelize = createSequelize(connection);

    const [first, second] = await Promise.all([
      refreshMetricsViews(sequelize),
      refreshMetricsViews(sequelize),
    ]);

    expect([first, second]).toEqual([true, false]);
    expect(sequelize.connectionManager.getConnection).toHaveBeenCalledTimes(1);
  });
});

describe('Metrics refresher refresh mode', () => {
  it('should refresh concurrently once the view is populated', async () => {
    const connection = createConnection({ populated: true });

    await refreshMetricsViews(createSequelize(connection));

    refreshStatements(connection).forEach((sql) => {
      expect(sql).toContain('REFRESH MATERIALIZED VIEW CONCURRENTLY');
    });
  });

  it('should refresh without CONCURRENTLY while the view has no data', async () => {
    const connection = createConnection({ populated: false });

    await refreshMetricsViews(createSequelize(connection));

    refreshStatements(connection).forEach((sql) => {
      expect(sql).not.toContain('CONCURRENTLY');
    });
  });
});

describe('Metrics refresher scheduling', () => {
  it('should stay disabled when the interval is zero', () => {
    expect(startMetricsRefresher({ METRICS_REFRESH_INTERVAL_MS: '0' })).toBeNull();
  });

  it('should stay disabled when the interval is not a number', () => {
    expect(startMetricsRefresher({ METRICS_REFRESH_INTERVAL_MS: 'daily' })).toBeNull();
  });

  it('should schedule with the configured interval', async () => {
    const connection = createConnection();
    const timer = startMetricsRefresher(
      { METRICS_REFRESH_INTERVAL_MS: '900000' },
      createSequelize(connection),
    );

    expect(timer).not.toBeNull();
    stopMetricsRefresher();

    // O primeiro refresh é disparado sem await; espera para não vazar no teardown.
    await new Promise((resolve) => { setImmediate(resolve); });
    expect(refreshStatements(connection)).toHaveLength(VIEWS.length);
  });
});
