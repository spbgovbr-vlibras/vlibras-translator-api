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
    }
    return redisClient;
  } catch (error) {
    throw new Error(redisClientError);
  }
};

export default redisConnection;
