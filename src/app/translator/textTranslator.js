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
import sentimentPhraseBreaker from '../util/sentimentPhraseBreaker.js';
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
    })

    AMQPChannel.consume(
      env.API_CONSUMER_QUEUE,
      async (message) => {
        setTimeout(() => {
          try {
            AMQPChannel.close();
          } catch (channelAlreadyClosedError) { /* empty */ }
        }, CHANNEL_CLOSE_TIMEOUT);

        try {
          if (message.properties.correlationId !== uid ) {
            if(!res.headersSent)
              return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
            else
              return undefined
          }
  
          const content = JSON.parse(message.content.toString());
         
          if (content.error !== undefined) {
            if(!res.headersSent)
              return next(createError(500, content.error));
            return undefined
          }
  
          if(!res.headersSent)
            res.status(200).send(content.translation);
  
          if (req.body.textHash) {
            try {
              const redisClient = await redisConnection();
              await redisClient.set(
                req.body.textHash,
                content.translation,
                'EX',
                env.CACHE_EXP,
              );
            } catch (error) {
              cacheError(`SET ${error.message}`);
            }
          }

          translation.set({ translation: content.translation });
          await translation.save();
        } catch (error) {
          serverError(error.message)
        }
       
        return undefined;
      },
      { noAck: true },
    );

    setTimeout(() => {
      if (!res.headersSent) {
        try {
          AMQPChannel.close();
        } catch (channelAlreadyClosedError) { /* empty */ }
        return next(createError(408, TRANSLATOR_ERROR.timeout));
      }
      return undefined;
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
    return await translation.save();
  } catch (error) {
    if (!res.headersSent)
      // TODO: refact this code before commit on prod
      return next(createError(500,TRANSLATOR_ERROR.translationError));
  }
};

const sentimentTranslator = async function sentimentTranslatorController(req, res, next) {
  try {
    const uid = uuid();
    console.log(`[DEBUG] Gerando UID da requisição: ${uid}`);

    const AMQPConnection = await queueConnection();
    console.log('[DEBUG] Conexão AMQP criada');

    const AMQPChannel = await AMQPConnection.createChannel();
    console.log('[DEBUG] Canal AMQP criado');

    const { consumerCount } = await AMQPChannel.assertQueue(
      env.TRANSLATOR_QUEUE,
      { durable: false },
    );
    console.log(`[DEBUG] Fila ${env.TRANSLATOR_QUEUE} possui ${consumerCount} consumidores`);

    if (consumerCount === 0) {
      try { AMQPChannel.close(); } catch {}
      console.error('[ERROR] Nenhum consumidor disponível na fila de tradução');
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    setTimeout(storeStats, 10, req);

    const translation = db.Translation.build({
      text: req.body.text,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });
    console.log('[DEBUG] Registro de tradução criado no banco');

    // Consumidor
    AMQPChannel.consume(
      env.API_CONSUMER_QUEUE,
      async (message) => {
        console.log('[DEBUG] Mensagem recebida do worker');
        setTimeout(() => {
          try { AMQPChannel.close(); } catch {}
        }, CHANNEL_CLOSE_TIMEOUT);

        try {
          console.log('[DEBUG] CorrelationId da mensagem:', message.properties.correlationId);
          if (message.properties.correlationId !== uid) {
            console.warn('[WARN] CorrelationId não confere');
            if (!res.headersSent)
              return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
            else return undefined;
          }

          const content = JSON.parse(message.content.toString());
          console.log('[DEBUG] Conteúdo da mensagem:', content);

          if (content.error !== undefined) {
            console.error('[ERROR] Worker retornou erro:', content.error);
            if (!res.headersSent)
              return next(createError(500, content.error));
            return undefined;
          }

          const translatedText = content.translation;
          console.log('[DEBUG] Texto traduzido recebido');

          // ---- Parte dos sentimentos ----
          const sentences = await sentimentPhraseBreaker(translatedText);
          console.log(`[DEBUG] ${sentences.length} frases quebradas`);

          const sentimentResults = [];

          for (const sentence of sentences) {
            try {
              const sentimento = await sentimentAnalyzer(sentence);
              sentimentResults.push({ traducao: sentence, sentimento });
              console.log(`[DEBUG] Sentimento da frase "${sentence}": ${sentimento}`);
            } catch (err) {
              sentimentResults.push({ traducao: sentence, sentimento: 'erro' });
              console.error('[ERROR] Erro ao analisar sentimento:', err.message);
            }
          }

          const counts = sentimentResults.reduce((acc, s) => {
            acc[s.sentimento] = (acc[s.sentimento] || 0) + 1;
            return acc;
          }, {});

          const sentimentoGeral = Object.entries(counts).reduce(
            (a, b) => (b[1] > a[1] ? b : a),
            ['', 0]
          )[0] || 'neutro';

          const responsePayload = {
            traducao: translatedText,
            sentimentoGeral,
            sentimentoPorSentenca: sentimentResults,
          };
          // ---- Fim da parte dos sentimentos ----

          if (!res.headersSent) {
            console.log('[DEBUG] Enviando resposta HTTP');
            res.status(200).json(responsePayload);
          }

          // Cache no Redis
          if (req.body.textHash) {
            try {
              const redisClient = await redisConnection();
              await redisClient.set(
                req.body.textHash,
                JSON.stringify(responsePayload),
                'EX',
                env.CACHE_EXP,
              );
              console.log('[DEBUG] Payload armazenado no Redis com sucesso');
            } catch (error) {
              console.error('[ERROR] Falha ao salvar no Redis:', error.message);
              cacheError(`SET ${error.message}`);
            }
          }

          translation.set({ translation: translatedText });
          await translation.save();
          console.log('[DEBUG] Tradução salva no banco');
        } catch (error) {
          console.error('[ERROR] Erro no processamento da tradução/sentimento:', error.message);
          serverError(`Erro no processamento da tradução/sentimento: ${error.message}`);
        }

        return undefined;
      },
      { noAck: true },
    );

    setTimeout(() => {
      if (!res.headersSent) {
        try { AMQPChannel.close(); } catch {}
        console.error('[ERROR] Timeout atingido sem resposta do worker');
        return next(createError(408, TRANSLATOR_ERROR.timeout));
      }
      return undefined;
    }, TRANSLATION_TIMEOUT);

    const payload = JSON.stringify({ text: req.body.text });
    console.log('[DEBUG] Publicando payload na fila de tradução');

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

    return await translation.save();
  } catch (error) {
    console.error('[ERROR] Erro no sentimentTranslator:', error.message);
    if (!res.headersSent)
      return next(createError(500, TRANSLATOR_ERROR.translationError));
  }
};


export { textTranslator, textTranslatorHealth, sentimentTranslator };
