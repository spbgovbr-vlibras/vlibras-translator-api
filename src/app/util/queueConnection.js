import amqplib from 'amqplib';

const connectionURL = {
  protocol: process.env.AMQP_PROTOCOL,
  hostname: process.env.AMQP_HOST,
  port: process.env.AMQP_PORT,
  username: process.env.AMQP_USER,
  password: process.env.AMQP_PASS,
};


/**
 * @var {Promise<MessageBroker>}
 */
let instance;

class MessageBroker {
  async init() {
    this.connection = await amqplib.connect(connectionURL);
    this.channel = await this.connection.createChannel();

    return this;
  }
}

/**
 * @return {Promise<MessageBroker>}
 */
MessageBroker.getInstance = async () => {
  if (!instance) {
    const broker = new MessageBroker();
    instance = await broker.init();
  }

  return instance;
};


export default MessageBroker;
