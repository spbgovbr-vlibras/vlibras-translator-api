import Redis from 'ioredis';

let redisClient;
let redisClientError;

const redisConnection = async function redisClientConnection() {
  try {
    if (redisClient === undefined) {
      redisClient = new Redis({
        port: process.env.CACHE_PORT,
        host: process.env.CACHE_HOST,
        connectionName: process.env.CACHE_NAME,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      redisClient.on('error', (err) => {
        redisClientError = err.message;
      });

      await redisClient.connect();
      await redisClient.config('SET', 'maxmemory', process.env.CACHE_SIZE || 104857600);
      await redisClient.config('SET', 'maxmemory-policy', 'allkeys-lfu');
      await redisClient.config('REWRITE');
    }
    return redisClient;
  } catch (error) {
    throw new Error(redisClientError || error.message);
  }
};

export default redisConnection;
