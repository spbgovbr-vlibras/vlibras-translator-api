import createError from 'http-errors';
import uuid from 'uuid/v4';
import env from '../../config/environments/environment';
// import queueConnection from '../util/queueConnection';
import redisConnection from '../util/redisConnection';
import { cacheError } from '../util/debugger';
import Translation from './Translation';
import Hit from './Hit';
import { TRANSLATOR_ERROR } from '../../config/error';
import {
  // CHANNEL_CLOSE_TIMEOUT,
  // TRANSLATION_TIMEOUT,
  TRANSLATION_PAYLOAD_TTL,
} from '../../config/timeout';


import phraseBreaker from '../util/phraseBreaker';
import TextTranslator from './TextTranslator';


let amqpTextTranslator;
let consumidor;

class TextTranslatorController {
  async textTranslatorController(req, res, next) {
    try {
      const callbackProperties = async () => {
        try {
          this.req = req;
          this.res = res;
          this.uid = uuid();
          this.next = next;
          this.TRANSLATOR_ERROR = TRANSLATOR_ERROR;
          return null;
        } catch (error) {
          return error;
        }
      };

      await callbackProperties();


      const amqpCallback = async (message) => {
        try {
          if (message.properties.correlationId !== this.uid) {
            return this.next(createError(500, TRANSLATOR_ERROR.wrongResponse));
          }

          const content = JSON.parse(message.content.toString());
          if (content.error !== undefined) {
            return this.next(createError(500, content.error));
          }
          this.res.status(200).send(content.translation);

          if (this.req.body.textHash) {
            try {
              const redisClient = await redisConnection();
              await redisClient.set(
                this.req.body.textHash,
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
              this.translationRequest._id,
              { translation: content.translation },
            ).exec();
          } catch (mongoNetworkError) { /* empty */ }

          return undefined;
        } catch (error) {
          return error;
        }
      };


      if (!amqpTextTranslator) {
        amqpTextTranslator = new TextTranslator();
      }

      const channel = await amqpTextTranslator.connection();
      const { consumerCount } = await channel.assertQueue(
        env.TRANSLATOR_QUEUE,
        { durable: false },
      );

      if (consumerCount === 0) {
        return next(createError(500, TRANSLATOR_ERROR.unavailable));
      }

      const phrases = await phraseBreaker(req.body.text);

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
        text: req.body.text,
        requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      });

      if (!consumidor) {
        consumidor = amqpTextTranslator;
        await consumidor.queueConsumer(amqpCallback, env.API_CONSUMER_QUEUE);
      }

      const payload = JSON.stringify({ text: req.body.text });

      await amqpTextTranslator.queuePublisher(
        env.TRANSLATOR_QUEUE,
        payload,
        {
          correlationId: this.uid,
          replyTo: env.API_CONSUMER_QUEUE,
          expiration: TRANSLATION_PAYLOAD_TTL,
        },
      );

      return await translationRequest.save();
    } catch (error) {
      return next(error);
    }
  }
}


const singleTextTranslator = new TextTranslatorController();
const { textTranslatorController } = singleTextTranslator;


export default textTranslatorController;
