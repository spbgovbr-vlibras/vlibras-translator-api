import createError from 'http-errors';

import env from '../../config/environments/environment.js';
import { TRANSLATOR_ERROR } from '../../config/error.js';
import {
  TRANSLATION_PAYLOAD_TTL,
  TRANSLATION_TIMEOUT,
} from '../../config/timeout.js';
import queueConnection from '../util/queueConnection.js';

const closeSafely = async (resource) => {
  if (!resource) {
    return;
  }

  try {
    await resource.close();
  } catch (_error) {
    // Ignore cleanup errors.
  }
};

const assertQueueHasConsumers = async (channel, queueName) => {
  const { consumerCount } = await channel.assertQueue(queueName, { durable: false });

  if (consumerCount === 0) {
    throw createError(500, TRANSLATOR_ERROR.unavailable);
  }
};

const parseMessageContent = (message) => {
  const content = JSON.parse(message.content.toString());

  if (content.error !== undefined) {
    throw createError(500, content.error);
  }

  return content;
};

const requestQueueReply = async ({
  correlationId,
  payload,
  queueName,
  timeoutMs = TRANSLATION_TIMEOUT,
  expiration = TRANSLATION_PAYLOAD_TTL,
}) => {
  const connection = await queueConnection();
  const channel = await connection.createChannel();
  let consumerTag;

  try {
    await assertQueueHasConsumers(channel, queueName);

    const response = await new Promise((resolve, reject) => {
      let settled = false;

      const finish = (callback) => (value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutHandle);
        callback(value);
      };

      const resolveOnce = finish(resolve);
      const rejectOnce = finish(reject);

      const timeoutHandle = setTimeout(() => {
        rejectOnce(createError(408, TRANSLATOR_ERROR.timeout));
      }, timeoutMs);

      channel.consume(
        env.API_CONSUMER_QUEUE,
        (message) => {
          if (!message || message.properties.correlationId !== correlationId) {
            return;
          }

          try {
            resolveOnce(parseMessageContent(message));
          } catch (error) {
            rejectOnce(error);
          }
        },
        { noAck: true },
      )
        .then((consumer) => {
          consumerTag = consumer.consumerTag;

          channel.publish(
            '',
            queueName,
            Buffer.from(JSON.stringify(payload)),
            {
              correlationId,
              replyTo: env.API_CONSUMER_QUEUE,
              expiration,
            },
          );
        })
        .catch(rejectOnce);
    });

    return response;
  } finally {
    if (consumerTag) {
      try {
        await channel.cancel(consumerTag);
      } catch (_error) {
        // Ignore consumer cleanup errors.
      }
    }

    await closeSafely(channel);
    await closeSafely(connection);
  }
};

export {
  assertQueueHasConsumers,
  requestQueueReply,
};
