import amqplib from 'amqplib';

let connection;

const connectionURL = {
  protocol: process.env.AMQP_PROTOCOL,
  hostname: process.env.AMQP_HOST,
  port: process.env.AMQP_PORT,
  username: process.env.AMQP_USER,
  password: process.env.AMQP_PASS,
};

const queueConnection = async function AMQPQueueConnection() {
  try {
    if (connection === undefined) {
      connection = await amqplib.connect(connectionURL);
      connection.on('close', () => {
        connection = undefined;
        return setTimeout(() => { AMQPQueueConnection(); }, 500);
      });
    }
    return connection;
  } catch (error) {
    if (connection !== undefined) {
      setTimeout(() => { connection.close(); }, 500);
    }
    throw new Error(error);
  }
};

export default queueConnection;
