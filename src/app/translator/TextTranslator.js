import MessageBroker from '../util/queueConnection';

let instance;

class TextTranslator {
  async connection() {
    this.messageBroker = await MessageBroker.getInstance();
    this.amqpChannel = this.messageBroker.channel;
    this.amqpCallback = undefined;

    return this.amqpChannel;
  }

  async queueConsumer(callback, queue) {
    await this.amqpChannel.consume(
      queue,
      callback,
      { noAck: true },
    );
  }

  async queuePublisher(translatorQueue, payload, properties) {
    const { correlationId, replyTo, expiration } = properties;

    this.amqpChannel.publish(
      '',
      translatorQueue,
      Buffer.from(payload),
      {
        correlationId,
        replyTo,
        expiration,
      },
    );
  }
}


TextTranslator.getInstance = async () => {
  if (!instance) {
    const broker = new TextTranslator();
    instance = await broker.connection();
  }

  return instance;
};


export default TextTranslator;
