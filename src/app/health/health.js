/* eslint-disable linebreak-style */
import mongoConnection from '../util/mongoConnection';
import queueConnection from '../util/queueConnection';

const packageJson = require('../../../package.json');

const checkDatabaseConnection = () => new Promise((resolve, reject) => {
  mongoConnection()
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

const health = async (req, res) => {
  try {
    const [database, queue] = await Promise.all([
      checkDatabaseConnection().catch((error) => ({ service: 'database', status: 'down', error })),
      checkQueueConnection().catch((error) => ({ service: 'queue', status: 'down', error })),
    ]);

    const response = {
      status: 'up',
      version: packageJson.version,
      database: database.status === 'up' ? 'up' : 'down',
      queue: queue.status === 'up' ? 'up' : 'down',
    };

    res.status(200).json(response);
  } catch (error) {
    const response = {
      status: 'up',
      version: packageJson.version,
      database: 'down',
      queue: 'down',
    };
    res.status(200).json(response);
  }
};


export default health;
