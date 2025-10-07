import createError from 'http-errors';
import { v4 as uuid } from 'uuid';
import env from '../../config/environments/environment.js';
import queueConnection from '../util/queueConnection.js';
import redisConnection from '../util/redisConnection.js';
import { cacheError, databaseError, serverError } from '../util/debugger.js';
import db from '../db/models/index.js';
import { TRANSLATOR_ERROR } from '../../config/error.js';
import {
  CHANNEL_CLOSE_TIMEOUT,
  TRANSLATION_TIMEOUT,
  TRANSLATION_PAYLOAD_TTL,
} from '../../config/timeout.js';
import phraseBreaker from '../util/phraseBreaker.js';
import { context, trace, SpanStatusCode, propagation } from '@opentelemetry/api';
import winston from 'winston';

const tracer = trace.getTracer('vlibras-translator-api');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

const amqpHeadersSetter = {
  set(carrier, key, value) {
    if (carrier && key) carrier[key] = value;
  },
};
const amqpHeadersGetter = {
  get(carrier, key) {
    return carrier ? carrier[key] : undefined;
  },
  keys(carrier) {
    return carrier ? Object.keys(carrier) : [];
  },
};

const storeStats = async function storeStatsController(req) {
  const span = tracer.startSpan('storeStats', { attributes: { 'app.component': 'stats' } });
  try {
    const phrases = await phraseBreaker(req.body.text);
    await db.sequelize.transaction(async (t) => {
      for (let i = 0; i < phrases.length; i = i + 1) {
        const phrase = phrases[i].trim();
        const findSpan = tracer.startSpan('sequelize.findOne', { attributes: { 'db.system': 'sequelize', 'db.entity': 'Hit' } });
        const translationAlreadyExists = await db.Hit.findOne({
          where: { text: phrase },
          transaction: t
        }).finally(() => findSpan.end());
        let translationHit = undefined;
        if (translationAlreadyExists) {
          translationAlreadyExists.set({ hits: translationAlreadyExists.hits + 1 });
          const saveSpan = tracer.startSpan('sequelize.save', { attributes: { 'db.system': 'sequelize', 'db.entity': 'Hit' } });
          await translationAlreadyExists.save({ transaction: t }).finally(() => saveSpan.end());
        } else {
          translationHit = db.Hit.build({ text: phrase, hits: 1 });
          const saveSpan = tracer.startSpan('sequelize.save', { attributes: { 'db.system': 'sequelize', 'db.entity': 'Hit' } });
          await translationHit.save({ transaction: t }).finally(() => saveSpan.end());
        }
      }
    });
  } catch (error) {
    logger.error(`[Stats] ${error.message}`);
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    serverError('Text translator failed storing stats');
  } finally {
    span.end();
  }
};

const textTranslatorHealth = async function textTranslatorController(req, res, next) {
  const handlerSpan = tracer.startSpan('textTranslatorHealth', { attributes: { 'app.component': 'http' } });
  const uid = req.uid;
  let AMQPChannel;
  let consumerTag;
  let timeoutId;

  const cleanup = async () => {
    clearTimeout(timeoutId);
    try { if (consumerTag) await AMQPChannel.cancel(consumerTag); } catch (e) { logger.warn(`Cancel warn: ${e.message}`); }
    try { if (AMQPChannel) await AMQPChannel.close(); } catch (e) { logger.warn(`Channel close warn: ${e.message}`); }
  };

  try {
    const AMQPConnection = await queueConnection();
    AMQPChannel = await AMQPConnection.createConfirmChannel();
    await AMQPChannel.prefetch(Number(process.env.AMQP_PREFETCH_COUNT || 10));
    const { consumerCount } = await AMQPChannel.assertQueue(env.TRANSLATOR_QUEUE, { durable: false });
    if (consumerCount === 0) {
      await cleanup();
      handlerSpan.end();
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    res.on('close', async () => { await cleanup(); });

    setTimeout(storeStats, 10, req);

    const translation = db.Translation.build({
      text: req.body.text,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    const { queue: replyQueue } = await AMQPChannel.assertQueue('', { exclusive: true, autoDelete: true, durable: false });

    const result = await new Promise(async (resolve, reject) => {
      const ok = await AMQPChannel.consume(
        replyQueue,
        async (message) => {
          try {
            if (message.properties.correlationId !== uid) {
              try { await AMQPChannel.nack(message, false, false); } catch {}
              return;
            }
            let content;
            try { content = JSON.parse(message.content.toString()); } catch (e) {
              try { await AMQPChannel.nack(message, false, false); } catch {}
              return;
            }
            if (content.error !== undefined) {
              try { await AMQPChannel.ack(message); } catch {}
              await cleanup();
              return reject(createError(500, content.error));
            }
            try { await AMQPChannel.ack(message); } catch {}
            await cleanup();
            resolve(content);
          } catch (error) {
            try { await AMQPChannel.nack(message, false, false); } catch {}
            await cleanup();
            reject(createError(500, error.message));
          }
        },
        { noAck: false },
      );
      consumerTag = ok.consumerTag;

      timeoutId = setTimeout(async () => {
        await cleanup();
        reject(createError(408, TRANSLATOR_ERROR.timeout));
      }, TRANSLATION_TIMEOUT);

      const payload = JSON.stringify({ text: req.body.text });
      const headers = {};
      propagation.inject(context.active(), headers, amqpHeadersSetter);
      AMQPChannel.publish('', env.TRANSLATOR_QUEUE, Buffer.from(payload), {
        correlationId: uid, replyTo: replyQueue, expiration: TRANSLATION_PAYLOAD_TTL, headers
      });
      await AMQPChannel.waitForConfirms();
    });

    if (result?.translation) {
      translation.set({ translation: result.translation });
    }
    await translation.save();

    handlerSpan.end();

    return res.status(200).json(result);
  } catch (error) {
    await cleanup();
    handlerSpan.end();
    return next(createError(500, TRANSLATOR_ERROR.translationError));
  }
};

const textTranslator = async function textTranslatorController(req, res, next) {
  const handlerSpan = tracer.startSpan('textTranslator', { attributes: { 'app.component': 'http' } });
  const uid = req.uid;
  let AMQPChannel;
  let consumerTag;
  let timeoutId;
  let responded = false;

  const cleanup = async () => {
    clearTimeout(timeoutId);
    try { if (consumerTag) await AMQPChannel.cancel(consumerTag); } catch (e) { logger.warn(`Cancel warn: ${e.message}`); }
    try { if (AMQPChannel) await AMQPChannel.close(); } catch (e) { logger.warn(`Channel close warn: ${e.message}`); }
  };

  try {
    const connSpan = tracer.startSpan('amqp.connection.get');
    const AMQPConnection = await queueConnection().finally(() => connSpan.end());
    logger.info('[TextTranslator] - Processando requisição: ' + uid);
    const chSpan = tracer.startSpan('amqp.createConfirmChannel');
    AMQPChannel = await AMQPConnection.createConfirmChannel().finally(() => chSpan.end());
    logger.info(`[RabbitMQ][${uid}] - Canal criado`);
    const prefetchSpan = tracer.startSpan('amqp.prefetch');
    await AMQPChannel.prefetch(Number(process.env.AMQP_PREFETCH_COUNT || 10)).finally(() => prefetchSpan.end());
    const assertSpan = tracer.startSpan('amqp.assertQueue', { attributes: { 'messaging.destination': env.TRANSLATOR_QUEUE, 'messaging.destination_kind': 'queue' } });
    const { consumerCount } = await AMQPChannel.assertQueue(env.TRANSLATOR_QUEUE, { durable: false }).finally(() => assertSpan.end());
    logger.info(`[RabbitMQ][${uid}] - Consumers ativos: ${consumerCount}`);
    if (consumerCount === 0) {
      await cleanup();
      handlerSpan.end();
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }
    const requesterIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const translation = db.Translation.build({ text: req.body.text, requester: requesterIp });
    const assertReplySpan = tracer.startSpan('amqp.assertReplyQueue');
    const { queue: replyQueue } = await AMQPChannel.assertQueue('', { exclusive: true, autoDelete: true, durable: false }).finally(() => assertReplySpan.end());
    res.on('close', async () => {
      if (!responded) {
        await cleanup();
      }
    });
    const ok = await AMQPChannel.consume(
      replyQueue,
      async (message) => {
        logger.info(`[RabbitMQ][${uid}] - Mensagem recebida na fila de resposta`);
        const consumeSpan = tracer.startSpan('amqp.consume', { attributes: { 'messaging.operation': 'receive' } });
        try {
          const correlationId = message.properties.correlationId;
          if (correlationId !== uid) {
            logger.error(`[RabbitMQ][${uid}] - correlationId inválido. Esperado: ${uid}, recebido: ${correlationId}`);
            consumeSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'wrongResponse' });
            try { await AMQPChannel.nack(message, false, false); } catch (e) { logger.warn(`Nack warn: ${e.message}`); }
            return;
          }
          const parentCtx = propagation.extract(context.active(), message?.properties?.headers || {}, amqpHeadersGetter);
          context.with(parentCtx, () => {});
          const parseSpan = tracer.startSpan('json.parse');
          const content = JSON.parse(message.content.toString());
          parseSpan.end();
          logger.info(`[RabbitMQ][${uid}] - Conteúdo recebido do worker: ${JSON.stringify(content)}`);
          if (content.error !== undefined) {
            logger.error(`[RabbitMQ][${uid}] - Erro retornado do worker: ${content.error}`);
            consumeSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(content.error) });
            try { await AMQPChannel.ack(message); } catch (e) { logger.warn(`Ack warn: ${e.message}`); }
            if (!res.headersSent) {
              responded = true;
              res.status(500).send(String(content.error));
            }
            await cleanup();
            return;
          }
          if (!res.headersSent) {
            res.status(200).send(content.translation);
            responded = true;
            logger.info(`[Express][${uid}] - Resposta enviada ao cliente`);
          }
          try { await AMQPChannel.ack(message); } catch (e) { logger.warn(`Ack warn: ${e.message}`); }
          if (req.body.textHash) {
            try {
              const redisSpan = tracer.startSpan('redis.set', { attributes: { 'db.system': 'redis', 'db.operation': 'SET' } });
              const redisClient = await redisConnection();
              await redisClient.set(req.body.textHash, content.translation, 'EX', env.CACHE_EXP);
              redisSpan.end();
            } catch (redisErr) {
              logger.error(`[Redis][${uid}] - ${redisErr.message}`);
              cacheError(`SET ${redisErr.message}`);
            }
          }
          translation.set({ translation: content.translation });
          const saveSpan = tracer.startSpan('sequelize.save', { attributes: { 'db.system': 'sequelize', 'db.entity': 'Translation' } });
          await translation.save().finally(() => saveSpan.end());
          await cleanup();
        } catch (err) {
          logger.error(`[Translator][${uid}] - ${err.message}`);
          consumeSpan.recordException(err);
          consumeSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          try { await AMQPChannel.nack(message, false, false); } catch (e) { logger.warn(`Nack warn: ${e.message}`); }
          if (!res.headersSent) {
            responded = true;
            res.status(500).send(TRANSLATOR_ERROR.translationError);
          }
          await cleanup();
        } finally {
          consumeSpan.end();
        }
      },
      { noAck: false },
    );
    consumerTag = ok.consumerTag;
    timeoutId = setTimeout(async () => {
      logger.info(`[Timeout][${uid}] - Timeout atingido após ${TRANSLATION_TIMEOUT}ms`);
      if (!res.headersSent) {
        await cleanup();
        return next(createError(408, TRANSLATOR_ERROR.timeout));
      }
    }, TRANSLATION_TIMEOUT);
    const payload = JSON.stringify({ text: req.body.text });
    const headers = {};
    propagation.inject(context.active(), headers, amqpHeadersSetter);
    const publishSpan = tracer.startSpan('amqp.publish', { attributes: { 'messaging.destination': env.TRANSLATOR_QUEUE, 'messaging.destination_kind': 'queue', 'messaging.rabbitmq.correlation_id': uid } });
    if (TRANSLATION_TIMEOUT >= TRANSLATION_PAYLOAD_TTL) {
      logger.warn(`[TimeoutGuard][${uid}] TRANSLATION_TIMEOUT (${TRANSLATION_TIMEOUT}) >= TTL (${TRANSLATION_PAYLOAD_TTL})`);
    }
    try {
      AMQPChannel.publish('', env.TRANSLATOR_QUEUE, Buffer.from(payload), { correlationId: uid, replyTo: replyQueue, expiration: TRANSLATION_PAYLOAD_TTL, headers });
      const confirmSpan = tracer.startSpan('amqp.waitForConfirms');
      await AMQPChannel.waitForConfirms().finally(() => confirmSpan.end());
      logger.info(`[RabbitMQ][${uid}] - Payload publicado`);
    } catch (err) {
      logger.error(`[RabbitMQ][${uid}] - Falha ao publicar payload: ${err.message}`);
      publishSpan.recordException(err);
      publishSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      if (!res.headersSent) {
        responded = true;
        res.status(500).send(TRANSLATOR_ERROR.translationError);
      }
      await cleanup();
    } finally {
      publishSpan.end();
    }
    handlerSpan.end();
  } catch (error) {
    logger.error(`[Fatal][${uid}] - ${error.message}`);
    handlerSpan.recordException(error);
    handlerSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    await cleanup();
    handlerSpan.end();
    if (!res.headersSent) {
      return next(createError(500, TRANSLATOR_ERROR.translationError));
    }
  }
};

export { textTranslator, textTranslatorHealth };
