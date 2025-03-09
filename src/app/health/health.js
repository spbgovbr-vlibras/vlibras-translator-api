import env from '../../config/environments/environment.js';
import db from '../db/models/index.js';
import queueConnection from '../util/queueConnection.js';
import redisConnection from '../util/redisConnection.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
);

const checkDatabaseConnection = () => new Promise((resolve, reject) => {
  db.sequelize.authenticate()
    .then(() => {
      resolve({ service: 'database', status: 'up' });
    })
    .catch((error) => { 
      reject(error);
    });
});

const checkQueueConnection = () => new Promise((resolve, reject) => {
  queueConnection()
    .then(() => {
      resolve({ service: 'queue', status: 'up' });
    })
    .catch((error) => {
      reject(error);
    });
});
const checkRedisConnection = () => new Promise((resolve) => {
  const redisClient = redisConnection();

  redisClient
    .then((client) => {
      if (client.status === 'ready') {
        resolve({ service: 'redis', status: 'up' });
      } else {
        resolve({ service: 'redis', status: 'down' });
      }
    })
    .catch(() => {
      resolve({ service: 'redis', status: 'down' });
    })
    .finally(() => {
      if (redisClient && typeof redisClient.disconnect === 'function') {
        redisClient.disconnect();
      }
    });
});

const checkConsumerCount = async () => {

  try {
    const connection = await queueConnection();
    const channel = await connection.createChannel();
    const result = await channel.assertQueue(
      env.TRANSLATOR_QUEUE,
      { durable: false },
    );
    const { consumerCount } = result;
    await channel.close();
    return consumerCount;
  } catch (error) {
    return error;
  }
};

const health = async (req, res, content) => {
  try {
    const [database, queue, redis, queueConsumerCount] = await Promise.all([
      checkDatabaseConnection().catch((error) => ({ service: 'database', status: 'down', error })),
      checkQueueConnection().catch((error) => ({ service: 'queue', status: 'down', error })),
      checkRedisConnection().catch((error) => ({ service: 'redis', status: 'down', error })),
      checkConsumerCount().catch((error) => ({ error })),
    ]);

    const isUp = [database, queue, redis].every(service => service.status === 'up');

    const response = {
      status: isUp ? 'up' : 'down',
      version: packageJson.version,
      database: database.status === 'up' ? 'up' : 'down',
      queue: queue.status === 'up' ? 'up' : 'down',
      redis: redis.status === 'up' ? 'up' : 'down',
      consumerCount: queueConsumerCount,
      versionTranslate: content.version || "No content available", 
    };

    res.status(200).json(response);
  } catch (error) {
    const response = {
      status: 'down',
      version: packageJson.version,
      database: 'down',
      queue: 'down',
      redis: 'down',
      consumerCount: 0,
      versionTranslate: content.version || "No content available",  
    };
    res.status(500).json(response);
  }
};


export default health;

