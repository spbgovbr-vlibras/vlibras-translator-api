import createError from 'http-errors';
import uuid from 'uuid/v4';
import env from '../../config/environments/environment';
import queueConnection from '../util/queueConnection';
import redisConnection from '../util/redisConnection';
import { cacheError } from '../util/debugger';
import Translation from './Translation';
import Hit from './Hit';
import DailyAccess from './DailyAccess';
import { TRANSLATOR_ERROR } from '../../config/error';
import {
  CHANNEL_CLOSE_TIMEOUT,
  TRANSLATION_TIMEOUT,
  TRANSLATION_PAYLOAD_TTL,
} from '../../config/timeout';


import phraseBreaker from '../util/phraseBreaker';
import wordCounter from '../util/wordCounter';

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
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    const { text, textHash, domain } = req.body;

    const phrases = await phraseBreaker(text);
    const wordCount = wordCounter(text);

    phrases.forEach(async (phrase) => {
      const translationAlreadyExists = await Hit.findOne({ text: phrase });

      if (translationAlreadyExists) {
        const translationHit = new Hit({
          text: translationAlreadyExists.text,
          hits: translationAlreadyExists.hits + 1,
        });
        await translationHit.save();
        return translationHit;
      }

      const translationHit = new Hit({
        text: phrase,
        hits: 1,
      });

      await translationHit.save();

      return translationHit;
    });

    const translationRequest = new Translation({
      text,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    AMQPChannel.consume(
      env.API_CONSUMER_QUEUE,
      async (message) => {
        setTimeout(() => {
          try {
            AMQPChannel.close();
          } catch (channelAlreadyClosedError) { /* empty */ }
        }, CHANNEL_CLOSE_TIMEOUT);

        if (message.properties.correlationId !== uid) {
          return next(createError(500, TRANSLATOR_ERROR.wrongResponse));
        }

        const content = JSON.parse(message.content.toString());
        if (content.error !== undefined) {
          return next(createError(500, content.error));
        }
        res.status(200).send(content.translation);

        if (textHash) {
          try {
            const redisClient = await redisConnection();
            await redisClient.set(
              textHash,
              content.translation,
              'EX',
              env.CACHE_EXP,
            );
          } catch (error) {
            cacheError(`SET ${error.message}`);
          }
        }

        try {
          await Translation.findByIdAndUpdate(
            translationRequest._id,
            { translation: content.translation },
          ).exec();
        } catch (mongoNetworkError) { /* empty */ }

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

    const payload = JSON.stringify({ text });

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

    if (domain) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let todayAccess = await DailyAccess.findOne({
        site: domain,
        createdAt: { $gte: startOfToday },
      });

      if (!todayAccess) {
        todayAccess = await DailyAccess.create({
          wordsAmount: 0,
          requestsAmount: 0,
          site: domain,
        });
      }

      await todayAccess.updateOne({ $inc: { requestsAmount: 1, wordsAmount: wordCount } });
    }

    return await translationRequest.save();
  } catch (error) {
    return next(error);
  }
};

export default textTranslator;
