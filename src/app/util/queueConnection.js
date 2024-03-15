import amqplib from 'amqplib';
import { serverError } from './app/util/debugger.js';

let AMQPConnection;

const connectionURL = {
  protocol: process.env.AMQP_PROTOCOL,
  hostname: process.env.AMQP_HOST,
  port: process.env.AMQP_PORT,
  username: process.env.AMQP_USER,
  password: process.env.AMQP_PASS,
};

const queueConnection = async function AMQPQueueConnection() {
  try {
    if (AMQPConnection === undefined) {
      AMQPConnection = await amqplib.connect(connectionURL);
      AMQPConnection.on('close', () => {
        AMQPConnection = undefined;    
      });
    }
    return AMQPConnection;
  } catch (error) {
    serverError('Queue connection failed. Reason: ', error)
    if (AMQPConnection !== undefined) {
      setTimeout(() => { AMQPConnection.close(); }, 500);
    }
    throw new Error(error);
  }
};

export default queueConnection;
