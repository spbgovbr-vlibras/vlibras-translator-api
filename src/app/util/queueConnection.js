import amqplib from 'amqplib';
import { serverError } from './debugger.js';

import { trace, SpanStatusCode } from '@opentelemetry/api';

let AMQPConnection;

const tracer = trace.getTracer('vlibras-translator-api');

const connectionURL = {
  protocol: process.env.AMQP_PROTOCOL,
  hostname: process.env.AMQP_HOST,
  port: Number(process.env.AMQP_PORT),
  username: process.env.AMQP_USER,
  password: process.env.AMQP_PASS,
  vhost: process.env.AMQP_VHOST || '/',
  heartbeat: Number(process.env.AMQP_HEARTBEAT || 180),
};

const queueConnection = async () => {
  const span = tracer.startSpan('amqp.queueConnection', {
    attributes: {
      'messaging.system': 'rabbitmq',
      'server.address': connectionURL.hostname,
      'server.port': connectionURL.port,
      'messaging.operation.type': 'create',
    },
  });

  try {
    if (!AMQPConnection) {
      console.log('[RabbitMQ] - Tentando conectar com RabbitMQ em:', connectionURL);
      const connectSpan = tracer.startSpan('amqp.connect', {
        attributes: {
          'messaging.system': 'rabbitmq',
          'server.address': connectionURL.hostname,
          'server.port': connectionURL.port,
        },
      });
      AMQPConnection = await amqplib.connect(connectionURL).finally(() => connectSpan.end());
      console.log('[RabbitMQ] - Conexão estabelecida com RabbitMQ');

      AMQPConnection.on('close', () => {
        const evtSpan = tracer.startSpan('amqp.connection.close', {
          attributes: { 'messaging.system': 'rabbitmq' },
        });
        evtSpan.end();
        console.warn('[RabbitMQ] - Conexão com RabbitMQ fechada');
        AMQPConnection = undefined;
      });

      AMQPConnection.on('error', (err) => {
        const evtSpan = tracer.startSpan('amqp.connection.error', {
          attributes: { 'messaging.system': 'rabbitmq' },
        });
        evtSpan.recordException(err);
        evtSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        evtSpan.end();
        console.error('[RabbitMQ] - Erro na conexão:', err.message);
      });
      span.setAttribute('messaging.connection.reused', false);
    } else {
      console.log('[RabbitMQ] - Reutilizando conexão existente');
      span.setAttribute('messaging.connection.reused', true);
    }
    span.end();
    return AMQPConnection;
  } catch (error) {
    serverError('Queue connection failed. Reason: ', error);
    console.error('[RabbitMQ] - Falha ao conectar com RabbitMQ:', error.message);
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.end();
    if (AMQPConnection) {
      setTimeout(() => {
        try { AMQPConnection.close(); console.log('[RabbitMQ] - Conexão fechada após erro'); }
        catch (closeErr) { console.warn('[RabbitMQ] - Erro ao fechar conexão após falha:', closeErr.message); }
      }, 500);
    }
    throw error;
  }
};

export default queueConnection;
