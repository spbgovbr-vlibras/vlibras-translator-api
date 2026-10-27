import amqplib from 'amqplib';
import baseLogger from './logger.js';

const logger = baseLogger.child({ component: 'rabbitmq' });

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
      // Nunca logar connectionURL inteiro: ele contém a senha.
      logger.info(
        { host: connectionURL.hostname, port: connectionURL.port },
        'Conectando ao RabbitMQ',
      );
      AMQPConnection = await amqplib.connect(connectionURL);
      logger.info('Conexão estabelecida com RabbitMQ');

      AMQPConnection.on('close', () => {
        logger.warn('Conexão com RabbitMQ fechada');
        AMQPConnection = undefined;
      });

      AMQPConnection.on('error', (err) => {
        logger.error({ err }, 'Erro na conexão com RabbitMQ');
      });
    } else {
      logger.debug('Reutilizando conexão existente');
    }
    return AMQPConnection;
  } catch (error) {
    logger.error({ err: error }, 'Falha ao conectar com RabbitMQ');

    if (AMQPConnection !== undefined) {
      setTimeout(() => {
        try {
          AMQPConnection.close();
          logger.info('Conexão fechada após erro');
        } catch (closeErr) {
          logger.warn({ err: closeErr }, 'Erro ao fechar conexão após falha');
        }
      }, 500);
    }
    throw new Error(error);
  }
};

export default queueConnection;
