import env from '../../../config/environments/environment.js';
import { context, trace } from '@opentelemetry/api';

const asNum = (v, d) => (v !== undefined ? Number(v) : d);

const logWithTrace = (sql, ms) => {
  try {
    const span = trace.getSpan(context.active());
    const ctx = span?.spanContext?.();
    const traceId = ctx?.traceId || 'unknown';
    const spanId = ctx?.spanId || 'unknown';
    const trimmed = sql.length > 800 ? `${sql.slice(0, 800)}...` : sql;
    // eslint-disable-next-line no-console
    console.log(`[sequelize] ${ms} ms trace_id=${traceId} span_id=${spanId} | ${trimmed}`);
  } catch {
    // eslint-disable-next-line no-console
    console.log(`[sequelize] ${ms} ms | ${sql}`);
  }
};

const base = {
  username: env.POSTGRES_USERNAME || process.env.POSTGRES_USERNAME,
  password: env.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DATABASE || process.env.POSTGRES_DATABASE,
  host: env.POSTGRES_HOST || process.env.POSTGRES_HOST,
  port: asNum(env.POSTGRES_PORT || process.env.POSTGRES_PORT, 5432),
  dialect: 'postgres',
  benchmark: true,
  logging: (env.DB_LOG === 'debug' || process.env.DB_LOG === 'debug') ? logWithTrace : false,

  pool: {
    max: asNum(process.env.DB_POOL_MAX, 25),
    min: asNum(process.env.DB_POOL_MIN, 5),
    acquire: asNum(process.env.DB_POOL_ACQUIRE, 60000),
    idle: asNum(process.env.DB_POOL_IDLE, 15000),
    evict: asNum(process.env.DB_POOL_EVICT, 30000),
    maxUses: asNum(process.env.DB_POOL_MAX_USES, 5000),
  },

  dialectOptions: {
    ssl: (process.env.DB_SSL === 'true')
      ? (
          process.env.DB_SSL_CA_PEM
            ? { require: true, rejectUnauthorized: true, ca: [process.env.DB_SSL_CA_PEM] }
            : { require: true, rejectUnauthorized: false }
        )
      : undefined,

    keepAlive: true,
    keepAliveInitialDelayMillis: asNum(process.env.DB_KEEPALIVE_DELAY, 600000),

    statement_timeout: asNum(process.env.DB_STATEMENT_TIMEOUT, 60000),
    idle_in_transaction_session_timeout: asNum(process.env.DB_IDLE_TX_TIMEOUT, 60000),
    lock_timeout: asNum(process.env.DB_LOCK_TIMEOUT, 2000),

    application_name: process.env.APP_NAME || 'vlibras-translator-api',
  },

  timezone: '+00:00',
};

export default {
  dev: { ...base, logging: (env.DB_LOG === 'debug') ? logWithTrace : false },
  test: { ...base, logging: false },
  production: { ...base, logging: false },
};
