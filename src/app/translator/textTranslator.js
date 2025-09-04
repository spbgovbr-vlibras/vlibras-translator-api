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

import {
  VALIDATION_VALUES
} from '../../config/validation.js';

import phraseBreaker from '../util/phraseBreaker.js';

/**
 * Asynchronous stores the statistics of the traslator at the DB.
 *
 * @param {Request} req - The http(s) request.
 */
const storeStats = async function storeStatsController(req) {

  try {
    
    const phrases = await phraseBreaker(req.body.text);
    await db.sequelize.transaction(async (t) => {
      for (let i = 0; i < phrases.length; i = i + 1) {
        const phrase = phrases[i].trim();
        const translationAlreadyExists = await db.Hit.findOne({
          where: {
            text: phrase
          },
          transaction: t
        });
  
        let translationHit = undefined;
        if (translationAlreadyExists) {
          translationAlreadyExists.set({hits: translationAlreadyExists.hits + 1});
          await translationAlreadyExists.save({ transaction: t });
        } else {
          translationHit = db.Hit.build({
            text: phrase,
            hits: 1,
          });
          await translationHit.save({ transaction: t });
        }
      }
    });
  } catch (error) {
    serverError('Text translator failed storing stats')
  }
}

const textTranslatorHealth = async function textTranslatorController(req, res, next) {
  const uid = req.uid;
  try {
    const AMQPConnection = await queueConnection();
    const AMQPChannel = await AMQPConnection.createChannel();

    const { consumerCount } = await AMQPChannel.assertQueue(
      env.TRANSLATOR_QUEUE,
      { durable: false },
    );

    if (consumerCount === 0) {
      try {
        AMQPChannel.close();
      } catch (channelAlreadyClosedError) { /* empty */ }
      
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    setTimeout(storeStats, 10, req); // 10miliseconds means now.

    const translation = db.Translation.build({
      text: req.body.text,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    const result = await new Promise((resolve, reject) => {
      AMQPChannel.consume(
        env.API_CONSUMER_QUEUE,
        async (message) => {
          try {
            if (message.properties.correlationId !== uid) {
              return reject(createError(500, TRANSLATOR_ERROR.wrongResponse));
            }

            const content = JSON.parse(message.content.toString());
            if (content.error !== undefined) {
              return reject(createError(500, content.error));
            }

            // Armazenar o conteúdo e resolver a promessa
            resolve(content);

          } catch (error) {
            reject(createError(500, error.message));
          }
        },
        { noAck: true },
      );

      setTimeout(() => {
        reject(createError(408, TRANSLATOR_ERROR.timeout));
      }, TRANSLATION_TIMEOUT);

      const payload = JSON.stringify({ text: req.body.text });

      AMQPChannel.publish(
        '',
        env.TRANSLATOR_QUEUE,
        Buffer.from(payload),
        {
          correlationId: uid,
          replyTo: env.API_CONSUMER_QUEUE,
          expiration: TRANSLATION_PAYLOAD_TTL,
        },
      );
    });

    await translation.save();
    return result;  // Retornar o conteúdo
  } catch (error) {
    return next(createError(500, TRANSLATOR_ERROR.translationError));
  }
};

const textTranslator = async function textTranslatorController(req, res, next) {
  const uid = req.uid;
  try {
    const { min, max } = VALIDATION_VALUES.textLength;
    if (req.body.text && (req.body.text.length < min || req.body.text.length > max)) {
      return next(createError(400, `Invalid input text. It must be between ${min} and ${max} characters.`));
    }

    const AMQPConnection = await queueConnection();
    const AMQPChannel = await AMQPConnection.createChannel();
    const { consumerCount } = await AMQPChannel.assertQueue(env.TRANSLATOR_QUEUE, { durable: false });

    if (consumerCount === 0) {
      console.warn(`[RabbitMQ][${uid}] -  Nenhum consumidor disponível na fila "${env.TRANSLATOR_QUEUE}"`);
      try {
        await AMQPChannel.close();
      } catch (err) {
        console.warn(`[RabbitMQ][${uid}] - Erro ao tentar fechar canal:`, err.message);
      }
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    const requesterIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const translation = db.Translation.build({
      text: req.body.text,
      requester: requesterIp,
    });
 
    AMQPChannel.consume(
      env.API_CONSUMER_QUEUE,
      async (message) => {
        setTimeout(() => {
          try {
            AMQPChannel.close();
          } catch (err) {
            console.warn(`[RabbitMQ][${uid}] - Canal já estava fechado (timeout)`);
          }
        }, CHANNEL_CLOSE_TIMEOUT);

        try {
          const correlationId = message.properties.correlationId;
          if (correlationId !== uid) {
            console.error(`[RabbitMQ][${uid}] - correlationId inválido. Esperado: ${uid}, recebido: ${correlationId}`);
            if (!res.headersSent)
              return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
            return;
          }

          const content = JSON.parse(message.content.toString());

          if (content.error !== undefined) {
            console.error(`[RabbitMQ][${uid}] - Erro retornado do worker:`, content.error);
            if (!res.headersSent)
              return next(createError(500, content.error));
            return;
          }

          if (!res.headersSent) {
            res.status(200).send(content.translation);
          }

          if (req.body.textHash) {
            try {
              const redisClient = await redisConnection();
              await redisClient.set(
                req.body.textHash,
                content.translation,
                'EX',
                env.CACHE_EXP
              );
            } catch (redisErr) {
              console.error(`[Redis][${uid}] - Falha ao conectar ou setar cache:`, redisErr.message);
              cacheError(`SET ${redisErr.message}`);
            }
          }
          translation.set({ translation: content.translation });
          await translation.save();
        } catch (err) {
          console.error(`[Translator][${uid}] - Erro ao processar a mensagem:`, err.message);
          serverError(err.message);
        }
      },
      { noAck: true },
    );

    setTimeout(() => {
      console.error(`[Timeout][${uid}] - Timeout atingido após ${TRANSLATION_TIMEOUT}ms`);
      if (!res.headersSent) {
        try {
          AMQPChannel.close();
        } catch (err) {
          console.warn(`[Timeout][${uid}] - Falha ao fechar canal após timeout:`, err.message);
        }
        return next(createError(408, TRANSLATOR_ERROR.timeout));
      }
    }, TRANSLATION_TIMEOUT);

    const payload = JSON.stringify({ text: req.body.text });

    await AMQPChannel.publish(
      '',
      env.TRANSLATOR_QUEUE,
      Buffer.from(payload),
      {
        correlationId: uid,
        replyTo: env.API_CONSUMER_QUEUE,
        expiration: TRANSLATION_PAYLOAD_TTL,
      },
    );
    await translation.save();

  } catch (error) {
    console.error(`[Fatal][${uid}] - Erro fatal na tradução:`, error.message);
    if (!res.headersSent) {
      return next(createError(500, TRANSLATOR_ERROR.translationError));
    }
  }
};


export {textTranslator, textTranslatorHealth};
