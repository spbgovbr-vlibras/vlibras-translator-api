/* eslint-disable consistent-return, no-await-in-loop, no-console */
import createError from 'http-errors';
import { v4 as uuid } from 'uuid';
import env from '../../config/environments/environment.js';
import queueConnection from '../util/queueConnection.js';
import redisConnection from '../util/redisConnection.js';
import { cacheError, serverError } from '../util/debugger.js';
import db from '../db/models/index.js';
import { TRANSLATOR_ERROR } from '../../config/error.js';
import {
  CHANNEL_CLOSE_TIMEOUT,
  TRANSLATION_TIMEOUT,
  TRANSLATION_PAYLOAD_TTL,
} from '../../config/timeout.js';
import { buildTextHash, getCachedTranslation } from '../middlewares/translationCache.js';
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
    serverError('Text translator failed storing stats');
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
  try {
    const AMQPConnection = await queueConnection();
    console.log('[TextTranslator] - Processando requisição:', uid);
    console.log(`[RabbitMQ][${uid}] - Conectado com sucesso`);

    const AMQPChannel = await AMQPConnection.createChannel();
    console.log(`[RabbitMQ][${uid}] - Canal criado`);

    const { consumerCount } = await AMQPChannel.assertQueue(
      env.TRANSLATOR_QUEUE,
      { durable: false },
    );
    console.log(`[RabbitMQ][${uid}] - Fila "${env.TRANSLATOR_QUEUE}" verificada. Consumers ativos: ${consumerCount}`);

    if (consumerCount === 0) {
      console.warn(`[RabbitMQ][${uid}] -  Nenhum consumidor disponível na fila "${env.TRANSLATOR_QUEUE}"`);
      try {
        await AMQPChannel.close();
        console.log(`[RabbitMQ][${uid}] - Canal fechado após ausência de consumidores`);
      } catch (err) {
        console.warn(`[RabbitMQ][${uid}] - Erro ao tentar fechar canal:`, err.message);
      }
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    console.log(`[Translator][${uid}] - Coleta de estatísticas agendada`);

    const requesterIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const translation = db.Translation.build({
      text: req.body.text,
      requester: requesterIp,
    });
    console.log(`[DB][${uid}] - Instância de tradução criada. Texto: "${req.body.text}" | IP: ${requesterIp}`);

    AMQPChannel.consume(
      env.API_CONSUMER_QUEUE,
      async (message) => {
        console.log(`[RabbitMQ][${uid}] - Mensagem recebida na fila de resposta`);

        setTimeout(() => {
          try {
            AMQPChannel.close();
            console.log(`[RabbitMQ][${uid}] - Canal fechado após consumo da resposta`);
          } catch (err) {
            console.warn(`[RabbitMQ][${uid}] - Canal já estava fechado (timeout)`);
          }
        }, CHANNEL_CLOSE_TIMEOUT);

        try {
          const { correlationId } = message.properties;
          if (correlationId !== uid) {
            console.error(`[RabbitMQ][${uid}] - correlationId inválido. Esperado: ${uid}, recebido: ${correlationId}`);
            if (!res.headersSent) return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
            return;
          }

          const content = JSON.parse(message.content.toString());
          console.log(`[RabbitMQ][${uid}] - Conteúdo recebido do worker:`, content);

          if (content.error !== undefined) {
            console.error(`[RabbitMQ][${uid}] - Erro retornado do worker:`, content.error);
            if (!res.headersSent) return next(createError(500, content.error));
            return;
          }

          if (!res.headersSent) {
            res.status(200).send(content.translation);
            console.log(`[Express][${uid}] - Resposta enviada ao cliente:`, content.translation);
          }

          if (req.body.textHash) {
            try {
              const redisClient = await redisConnection();
              console.log(`[Redis][${uid}] - Conexão com Redis estabelecida`);
              await redisClient.set(
                req.body.textHash,
                content.translation,
                'EX',
                env.CACHE_EXP,
              );
              console.log(`[Redis][${uid}] - Tradução armazenada com chave "${req.body.textHash}" por ${env.CACHE_EXP} segundos`);
            } catch (redisErr) {
              console.error(`[Redis][${uid}] - Falha ao conectar ou setar cache:`, redisErr.message);
              cacheError(`SET ${redisErr.message}`);
            }
          }

          translation.set({ translation: content.translation });
          await translation.save();
          console.log(`[DB][${uid}] - Tradução salva no banco de dados`);
        } catch (err) {
          console.error(`[Translator][${uid}] - Erro ao processar a mensagem:`, err.message);
          serverError(err.message);
        }
      },
      { noAck: true },
    );

    console.log(`[RabbitMQ][${uid}] - Consumidor registrado na fila "${env.API_CONSUMER_QUEUE}"`);

    setTimeout(() => {
      console.log(`[Timeout][${uid}] - Timeout atingido após ${TRANSLATION_TIMEOUT}ms`);
      if (!res.headersSent) {
        try {
          AMQPChannel.close();
        } catch (err) {
          console.warn(`[Timeout][${uid}] - Falha ao fechar canal após timeout:`, err.message);
        }
        return next(createError(408, TRANSLATOR_ERROR.timeout));
      }
    }, TRANSLATION_TIMEOUT);
    console.log(`[Timeout][${uid}] - Timeout programado para ${TRANSLATION_TIMEOUT}ms`);

    const payload = JSON.stringify({ text: req.body.text });
    console.log(`[RabbitMQ][${uid}] - Publicando payload:`, payload);

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
    console.log(`[RabbitMQ][${uid}] - Payload publicado na fila "${env.TRANSLATOR_QUEUE}" com TTL ${TRANSLATION_PAYLOAD_TTL}ms`);

    await translation.save();
    console.log(`[DB][${uid}] - Registro salvo inicialmente no banco para log`);
  } catch (error) {
    console.error(`[Fatal][${uid}] - Erro fatal na tradução:`, error.message);
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
        req.body.textHash = cacheEntry.textHash;
        cachedGloss = cacheEntry.cachedTranslation ?? undefined;
      } catch (cacheErr) {
        req.body.textHash = buildTextHash(req.body.text);
        cacheError(`GET ${cacheErr.message}`);
      }
    } else {
      req.body.textHash = buildTextHash(req.body.text);
    }

    const refinementGloss = providedGloss && providedGloss.length > 0
      ? providedGloss
      : (cachedGloss ?? '');

    const refinedGloss = await glossRefinementService.refineGloss({
      gloss: refinementGloss,
      text: req.body.text,
      uid,
    });

    if (req.body.textHash) {
      try {
        const redisClient = await redisConnection();
        await redisClient.set(
          req.body.textHash,
          refinedGloss,
          'EX',
          env.CACHE_EXP,
        );
      } catch (redisErr) {
        cacheError(`SET ${redisErr.message}`);
      }
    }

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
      cacheError(`SET ${error.message}`);
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
      serverError(`Erro ao atualizar tradução no DB: ${error.message}`);
    }
  } catch (error) {
    if (!res.headersSent) {
      return next(error);
    }
    console.error('[ERROR] Erro após resposta HTTP já ter sido enviada:', error);
  } finally {
    if (AMQPChannel) {
      try {
        await AMQPChannel.close();
      } catch (closeError) {
        console.error('[ERROR] Erro ao fechar canal AMQP no finally:', closeError);
      }
    }
  }
};

export {
  textTranslator, textTranslatorHealth, sentimentTranslator, refinedTextTranslator,
};
