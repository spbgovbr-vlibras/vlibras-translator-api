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
      AMQPChannel.close()
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

export default textTranslator;
