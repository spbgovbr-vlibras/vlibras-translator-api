/* eslint-disable consistent-return, no-await-in-loop, no-console */
import createError from 'http-errors';
import { v4 as uuid } from 'uuid';
import env from '../../config/environments/environment.js';
import queueConnection from '../util/queueConnection.js';
import redisConnection from '../util/redisConnection.js';
import db from '../db/models/index.js';
import { TRANSLATOR_ERROR } from '../../config/error.js';
import {
  CHANNEL_CLOSE_TIMEOUT,
  TRANSLATION_TIMEOUT,
  TRANSLATION_PAYLOAD_TTL,
} from '../../config/timeout.js';
import { VALIDATION_VALUES } from '../../config/validation.js';
import { getCachedTranslation } from '../middlewares/translationCache.js';
import { requestQueueReply } from './amqpRpc.js';
import { glossRefinementService } from './glossRefinement.js';
import phraseBreaker from '../util/phraseBreaker.js';
import sentimentAnalyzer from '../util/sentimentAnalyzer.js';

/**
 * Asynchronous stores the statistics of the traslator at the DB.
 *
 * @param {Request} req - The http(s) request.
 */
const storeStats = async function storeStatsController(req) {
  try {
    const phrases = await phraseBreaker(req.body.text);
    await db.sequelize.transaction(async (t) => {
      for (let i = 0; i < phrases.length; i += 1) {
        const phrase = phrases[i].trim();
        const translationAlreadyExists = await db.Hit.findOne({
          where: {
            text: phrase,
          },
          transaction: t,
        });

        let translationHit;
        if (translationAlreadyExists) {
          translationAlreadyExists.set({ hits: translationAlreadyExists.hits + 1 });
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
    req.log.error({ err: error, component: 'db' }, 'Falha ao registrar estatísticas da tradução');
  }
};

const textTranslatorHealth = async function textTranslatorController(req, res, next) {
  const { uid } = req;
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
    return result; // Retornar o conteúdo
  } catch (error) {
    return next(createError(500, TRANSLATOR_ERROR.translationError));
  }
};

const textTranslator = async function textTranslatorController(req, res, next) {
  const { uid } = req;
  const log = req.log.child({ component: 'translator' });
  try {
    const { min, max } = VALIDATION_VALUES.textLength;
    if (req.body.text && (req.body.text.length < min || req.body.text.length > max)) {
      return next(createError(400, `Invalid input text. It must be between ${min} and ${max} characters.`));
    }

    const AMQPConnection = await queueConnection();
    const AMQPChannel = await AMQPConnection.createChannel();

    const { consumerCount } = await AMQPChannel.assertQueue(
      env.TRANSLATOR_QUEUE,
      { durable: false },
    );
    log.debug({ queue: env.TRANSLATOR_QUEUE, consumerCount }, 'Fila verificada');

    if (consumerCount === 0) {
      log.warn({ queue: env.TRANSLATOR_QUEUE }, 'Nenhum consumidor disponível na fila');
      try {
        await AMQPChannel.close();
      } catch (err) {
        log.warn({ err }, 'Erro ao tentar fechar canal');
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
            log.debug('Canal já estava fechado');
          }
        }, CHANNEL_CLOSE_TIMEOUT);

        try {
          const { correlationId } = message.properties;
          if (correlationId !== uid) {
            log.error({ correlationId }, 'correlationId inválido na resposta da fila');
            if (!res.headersSent) return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
            return;
          }

          const content = JSON.parse(message.content.toString());

          if (content.error !== undefined) {
            log.error({ workerError: content.error }, 'Erro retornado pelo worker');
            if (!res.headersSent) return next(createError(500, content.error));
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
                env.CACHE_EXP,
              );
            } catch (redisErr) {
              log.error({ err: redisErr, component: 'cache' }, 'Falha ao gravar tradução no cache');
            }
          }
          translation.set({ translation: content.translation });
          await translation.save();
        } catch (err) {
          log.error({ err }, 'Erro ao processar a resposta da fila');
        }
      },
      { noAck: true },
    );

    setTimeout(() => {
      if (!res.headersSent) {
        log.error({ timeoutMs: TRANSLATION_TIMEOUT }, 'Timeout aguardando resposta da fila');
        try {
          AMQPChannel.close();
        } catch (err) {
          log.warn({ err }, 'Falha ao fechar canal após timeout');
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
    log.error({ err: error }, 'Erro fatal na tradução');
    if (!res.headersSent) {
      return next(createError(500, TRANSLATOR_ERROR.translationError));
    }
  }
};

const refinedTextTranslator = async function refinedTextTranslatorController(req, res, next) {
  const { uid } = req;

  try {
    setTimeout(storeStats, 10, req);

    const requesterIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const translation = db.Translation.build({
      text: req.body.text,
      requester: requesterIp,
    });

    let cachedGloss;
    const providedGloss = typeof req.body.gloss === 'string' ? req.body.gloss : undefined;

    if (providedGloss === undefined || providedGloss.length === 0) {
      try {
        const cacheEntry = await getCachedTranslation(req.body.text);
        cachedGloss = cacheEntry.cachedTranslation ?? undefined;
      } catch (cacheErr) {
        req.log.error({ err: cacheErr, component: 'cache' }, 'Falha ao consultar o cache');
      }
    }

    const refinementGloss = providedGloss && providedGloss.length > 0
      ? providedGloss
      : (cachedGloss ?? '');

    const refinedGloss = await glossRefinementService.refineGloss({
      gloss: refinementGloss,
      text: req.body.text,
      uid,
    });

    translation.set({ translation: refinedGloss });
    await translation.save();

    res.status(200).send(refinedGloss);
  } catch (error) {
    if (!res.headersSent) {
      next(error.status ? error : createError(500, TRANSLATOR_ERROR.translationError));
    }
  }
};

const sentimentTranslator = async function sentimentTranslatorController(req, res, next) {
  const uid = uuid();
  let AMQPChannel;

  try {
    const AMQPConnection = await queueConnection();
    AMQPChannel = await AMQPConnection.createChannel();

    const { consumerCount } = await AMQPChannel.assertQueue(
      env.TRANSLATOR_QUEUE,
      { durable: false },
    );

    if (consumerCount === 0) {
      throw createError(500, TRANSLATOR_ERROR.unavailable);
    }

    setTimeout(storeStats, 10, req);

    const translation = db.Translation.build({
      text: req.body.text,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    const consumePromise = new Promise((resolve, reject) => {
      AMQPChannel.consume(
        env.API_CONSUMER_QUEUE,
        async (message) => {
          try {
            if (!message) {
              return reject(createError(500, TRANSLATOR_ERROR.translationError));
            }

            if (message.properties.correlationId !== uid) {
              AMQPChannel.nack(message, false, false);
              return;
            }

            const content = JSON.parse(message.content.toString());

            if (content.error !== undefined) {
              return reject(createError(500, content.error));
            }

            const translatedText = content.translation || '';

            let sentimentAnalysisResult;
            try {
              if (translatedText.length > 0) {
                sentimentAnalysisResult = await sentimentAnalyzer(req.body.text, translatedText);
              } else {
                sentimentAnalysisResult = {
                  sentimentoGeral: 'neutro',
                  sentimentoPorSentenca: [],
                };
              }
            } catch (sentimentError) {
              sentimentAnalysisResult = {
                sentimentoGeral: 'ERRO_API_GERAL',
                sentimentoPorSentenca: [{ traducao: translatedText, sentimento: 'ERRO_API_GERAL' }],
              };
            }

            const responsePayload = {
              traducao: translatedText,
              sentimentoGeral: sentimentAnalysisResult.sentimentoGeral || 'neutro',
              sentimentoPorSentenca: sentimentAnalysisResult.sentimentoPorSentenca || [],
            };

            resolve(responsePayload);
          } catch (error) {
            reject(createError(500, error.message || TRANSLATOR_ERROR.translationError));
          }
        },
        { noAck: true },
      );

      setTimeout(() => {
        reject(createError(408, TRANSLATOR_ERROR.timeout));
      }, TRANSLATION_TIMEOUT);
    });

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

    const finalPayload = await consumePromise;

    if (!res.headersSent) {
      res.status(200).json(finalPayload);
    }

    try {
      if (req.body.textHash && finalPayload) {
        const redisClient = await redisConnection();
        await redisClient.set(
          req.body.textHash,
          JSON.stringify(finalPayload),
          'EX',
          env.CACHE_EXP,
        );
      }
    } catch (error) {
      req.log.error({ err: error, component: 'cache' }, 'Falha ao gravar tradução no cache');
    }

    try {
      if (
        finalPayload
        && finalPayload.traducao !== undefined
        && translation
      ) {
        translation.set({ translation: finalPayload.traducao });
        await translation.save();
      }
    } catch (error) {
      req.log.error({ err: error, component: 'db' }, 'Erro ao atualizar tradução no banco');
    }
  } catch (error) {
    if (!res.headersSent) {
      return next(error);
    }
    req.log.error({ err: error }, 'Erro após resposta HTTP já ter sido enviada');
  } finally {
    if (AMQPChannel) {
      try {
        await AMQPChannel.close();
      } catch (closeError) {
        req.log.error({ err: closeError }, 'Erro ao fechar canal AMQP');
      }
    }
  }
};

export {
  textTranslator, textTranslatorHealth, sentimentTranslator, refinedTextTranslator,
};
