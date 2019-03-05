import amqplib from 'amqplib';

let connection;
let channel;

const connectionURL = {
	protocol: process.env.AMQP_PROTOCOL,
	hostname: process.env.AMQP_HOST,
	port: process.env.AMQP_PORT,
	username: process.env.AMQP_USER,
	password: process.env.AMQP_PASS
};

const setupChannel = async function setupConnectionChannel() {
	try {
		if (connection === undefined) {
			connection = await amqplib.connect(connectionURL);
		}
		
		if (channel === undefined) {
			channel = await connection.createChannel();
		}
		
		return true;

	} catch (error) {
		if (connection !== undefined) {
			setTimeout(() => {
				connection.close();
			}, 500);
		}

		throw new Error(error);
	}
}

const sendToQueue = async function sendMessageToQueue(route, message, id) {
	try {
		await setupChannel();

		await channel.assertExchange(
			process.env.EXCHANGE_NAME,
			process.env.EXCHANGE_TYPE,
			{ durable: true }
		);

		return channel.publish(
			process.env.EXCHANGE_NAME,
			route,
			Buffer.from(message),
			{ correlationId: id, replyTo: process.env.CONSUMER_QUEUE }
		);

	} catch (error) {
		if (connection !== undefined) {
			setTimeout(() => {
				connection.close();
			}, 500);
		}

		throw new Error(error);
	}
}

const consumeFromQueue = async function startConsumeFromQueue(callback) {
	try {
		await setupChannel();

		await channel.assertQueue(
			process.env.CONSUMER_QUEUE,
			{ durable: true }
		);

		return channel.consume(
			process.env.CONSUMER_QUEUE,
			callback,
			{ noAck: true }
		);
		
	} catch (error) {
		if (connection !== undefined) {
			setTimeout(() => {
				connection.close();
			}, 500);
		}

		throw new Error(error);
	}
}

export { sendToQueue, consumeFromQueue };
