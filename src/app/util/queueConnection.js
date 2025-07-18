import amqplib from 'amqplib';
import { serverError } from './debugger.js';

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
      console.log('[RabbitMQ] - Tentando conectar com RabbitMQ em:', connectionURL);
      AMQPConnection = await amqplib.connect(connectionURL);
      console.log('[RabbitMQ] - Conexão estabelecida com RabbitMQ');

      AMQPConnection.on('close', () => {
        console.warn('[RabbitMQ] - Conexão com RabbitMQ fechada');
        AMQPConnection = undefined;
      });

      AMQPConnection.on('error', (err) => {
        console.error('[RabbitMQ] - Erro na conexão:', err.message);
      });
    } else {
      console.log('[RabbitMQ] - Reutilizando conexão existente');
    }
    return AMQPConnection;
  } catch (error) {
    serverError('Queue connection failed. Reason: ', error);
    console.error('[RabbitMQ] - Falha ao conectar com RabbitMQ:', error.message);

    if (AMQPConnection !== undefined) {
      setTimeout(() => {
        try {
          AMQPConnection.close();
          console.log('[RabbitMQ] - Conexão fechada após erro');
        } catch (closeErr) {
          console.warn('[RabbitMQ] - Erro ao fechar conexão após falha:', closeErr.message);
        }
      }, 500);
    }
    throw new Error(error);
  }
};

export default queueConnection;
