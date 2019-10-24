import createError from 'http-errors';
import uuid from 'uuid/v4';
import environment from '../../config/environments/environment';
import queueConnection from '../util/queueConnection';
import redisConnection from '../util/redisConnection';
import { cacheError } from '../util/debugger';
import Translation from './Translation';
import { TRANSLATOR_ERROR } from '../../config/error';
import {
  CHANNEL_CLOSE_TIMEOUT,
  TRANSLATION_TIMEOUT,
  TRANSLATION_PAYLOAD_TTL,
} from '../../config/timeout';

const textTranslator = async function textTranslatorController(req, res, next) {
  try {
    const uid = uuid();
    const AMQPConnection = await queueConnection();
    const AMQPChannel = await AMQPConnection.createChannel();

    const { consumerCount } = await AMQPChannel.assertQueue(
      environment.TRANSLATOR_QUEUE,
      { durable: false },
    );

    if (consumerCount === 0) {
      return next(createError(500, TRANSLATOR_ERROR.unavailable));
    }

    const translationRequest = new Translation({
      text: req.body.text,
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    AMQPChannel.consume(
      environment.API_CONSUMER_QUEUE,
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

        if (req.body.textHash) {
          try {
            const redisClient = await redisConnection();
            await redisClient.set(
              req.body.textHash,
              content.translation,
              'EX',
              environment.CACHE_EXP,
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

    const payload = JSON.stringify({ text: req.body.text });

    await AMQPChannel.publish(
      '',
      environment.TRANSLATOR_QUEUE,
      Buffer.from(payload),
      {
        correlationId: uid,
        replyTo: environment.API_CONSUMER_QUEUE,
        expiration: TRANSLATION_PAYLOAD_TTL,
      },
    );

    return await translationRequest.save();
  } catch (error) {
    return next(error);
  }
};

export default textTranslator;
