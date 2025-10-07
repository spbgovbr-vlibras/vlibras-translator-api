import Redis from 'ioredis';
import { trace, SpanStatusCode } from '@opentelemetry/api';

let redisClient;
let redisClientError;
let connectPromise;

const tracer = trace.getTracer('vlibras-translator-api');

const redisConnection = async function redisClientConnection() {
  const span = tracer.startSpan('redis.connection', {
    attributes: {
      'db.system': 'redis',
      'server.address': process.env.CACHE_HOST,
      'server.port': Number(process.env.CACHE_PORT),
    },
  });

  try {
    if (!redisClient) {
      const port = Number(process.env.CACHE_PORT) || 6379;
      const createSpan = tracer.startSpan('redis.client.create', {
        attributes: { 'db.system': 'redis' },
      });

      const options = {
        port,
        host: process.env.CACHE_HOST,
        connectionName: process.env.CACHE_NAME,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: Number(process.env.CACHE_CONNECT_TIMEOUT) || 15000,
        enableAutoPipelining: true,
        ...(process.env.CACHE_PASS && { password: process.env.CACHE_PASS }),
        ...(process.env.CACHE_TLS === 'true' && { tls: { rejectUnauthorized: false } }),
      };

      redisClient = new Redis(options);

      createSpan.end();

      redisClient.on('error', (err) => {
        redisClientError = err.message;
      });
      redisClient.on('close', () => {
        if (!redisClientError) redisClientError = 'Redis connection closed';
      });
    }

    if (!connectPromise) {
      const connectSpan = tracer.startSpan('redis.connect', {
        attributes: { 'db.system': 'redis' },
      });
      connectPromise = redisClient
        .connect()
        .catch((e) => {
          throw e;
        })
        .finally(() => connectSpan.end());
    }

    await connectPromise;

    const maxmemory = String(process.env.CACHE_SIZE || 104857600);
    const policy = 'allkeys-lfu';
    const saveRule = '86400 1';

    const cfgSpan = tracer.startSpan('redis.config.pipeline', {
      attributes: { 'db.system': 'redis' },
    });

    await redisClient
      .pipeline()
      .config('SET', 'maxmemory', maxmemory)
      .config('SET', 'maxmemory-policy', policy)
      .config('SET', 'save', saveRule)
      .exec()
      .catch((e) => {
        throw e;
      })
      .finally(() => cfgSpan.end());

    redisClientError = undefined;
    span.end();
    return redisClient;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.end();
    throw new Error(redisClientError || error.message);
  }
};

export default redisConnection;
