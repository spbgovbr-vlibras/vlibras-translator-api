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
  try {
    const uid = uuid();
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
  try {
    console.log('[ENV] 🌍 Dump completo do objeto env:', env);

    const uid = uuid();

    const AMQPConnection = await queueConnection();
    console.log('[RabbitMQ] - Conectado com sucesso');

    const AMQPChannel = await AMQPConnection.createChannel();
    console.log('[RabbitMQ] - Canal criado');

    const { consumerCount } = await AMQPChannel.assertQueue(env.TRANSLATOR_QUEUE, { durable: false });
    console.log(`[RabbitMQ] - Fila "${env.TRANSLATOR_QUEUE}" verificada. Consumers ativos: ${consumerCount}`);

    if (consumerCount === 0) {
      console.warn(`[RabbitMQ] -  Nenhum consumidor disponível na fila "${env.TRANSLATOR_QUEUE}"`);
      try {
        await AMQPChannel.close();
        console.log('[RabbitMQ] - Canal fechado após ausência de consumidores');
      } catch (err) {
        console.warn('[RabbitMQ] - Erro ao tentar fechar canal:', err.message);
      }
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    console.log('[Translator] - Coleta de estatísticas agendada');

    const requesterIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const translation = db.Translation.build({
      text: req.body.text,
      requester: requesterIp,
    });
    console.log(`[DB] - Instância de tradução criada. Texto: "${req.body.text}" | IP: ${requesterIp}`);

    AMQPChannel.consume(
      env.API_CONSUMER_QUEUE,
      async (message) => {
        console.log('[RabbitMQ] - Mensagem recebida na fila de resposta');

        setTimeout(() => {
          try {
            AMQPChannel.close();
            console.log('[RabbitMQ] - Canal fechado após consumo da resposta');
          } catch (err) {
            console.warn('[RabbitMQ] - Canal já estava fechado (timeout)');
          }
        }, CHANNEL_CLOSE_TIMEOUT);

        try {
          const correlationId = message.properties.correlationId;
          if (correlationId !== uid) {
            console.error(`[RabbitMQ] - correlationId inválido. Esperado: ${uid}, recebido: ${correlationId}`);
            if (!res.headersSent)
              return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
            return;
          }

          const content = JSON.parse(message.content.toString());
          console.log('[RabbitMQ] - Conteúdo recebido do worker:', content);

          if (content.error !== undefined) {
            console.error('[RabbitMQ] - Erro retornado do worker:', content.error);
            if (!res.headersSent)
              return next(createError(500, content.error));
            return;
          }

          if (!res.headersSent) {
            res.status(200).send(content.translation);
            console.log('[Express] - Resposta enviada ao cliente:', content.translation);
          }

          if (req.body.textHash) {
            try {
              const redisClient = await redisConnection();
              console.log('[Redis] - Conexão com Redis estabelecida');
              await redisClient.set(
                req.body.textHash,
                content.translation,
                'EX',
                env.CACHE_EXP
              );
              console.log(`[Redis] - Tradução armazenada com chave "${req.body.textHash}" por ${env.CACHE_EXP} segundos`);
            } catch (redisErr) {
              console.error('[Redis] - Falha ao conectar ou setar cache:', redisErr.message);
              cacheError(`SET ${redisErr.message}`);
            }
          }

          translation.set({ translation: content.translation });
          await translation.save();
          console.log('[DB] - Tradução salva no banco de dados');
        } catch (err) {
          console.error('[Translator] - Erro ao processar a mensagem:', err.message);
          serverError(err.message);
        }
      },
      { noAck: true },
    );

    console.log(`[RabbitMQ] - Consumidor registrado na fila "${env.API_CONSUMER_QUEUE}"`);

    setTimeout(() => {
      if (!res.headersSent) {
        try {
          AMQPChannel.close();
          console.log(`[Timeout] - Timeout atingido após ${TRANSLATION_TIMEOUT}ms. Canal fechado`);
        } catch (err) {
          console.warn('[Timeout] - Falha ao fechar canal após timeout:', err.message);
        }
        return next(createError(408, TRANSLATOR_ERROR.timeout));
      }
    }, TRANSLATION_TIMEOUT);
    console.log(`[Timeout] - Timeout programado para ${TRANSLATION_TIMEOUT}ms`);

    const payload = JSON.stringify({ text: req.body.text });
    console.log('[RabbitMQ] - Publicando payload:', payload);

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
    console.log(`[RabbitMQ] - Payload publicado na fila "${env.TRANSLATOR_QUEUE}" com TTL ${TRANSLATION_PAYLOAD_TTL}ms`);

    await translation.save();
    console.log('[DB] - Registro salvo inicialmente no banco para log');

  } catch (error) {
    console.error('[Fatal] - Erro fatal na tradução:', error.message);
    if (!res.headersSent) {
      return next(createError(500, TRANSLATOR_ERROR.translationError));
    }
  }
};


export {textTranslator, textTranslatorHealth};
