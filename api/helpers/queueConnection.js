import amqplib from 'amqplib';

let connection;

const connectionURL = {
	protocol: process.env.AMQP_PROTOCOL,
	hostname: process.env.AMQP_HOST,
	port: process.env.AMQP_PORT,
	username: process.env.AMQP_USER,
	password: process.env.AMQP_PASS
};

const setupConnection = async function setupQueueConnection() {
	try {
		if (connection === undefined) {
			connection = await amqplib.connect(connectionURL);
		}

		return await connection.createChannel();

	} catch (error) {
		if (connection !== undefined) {
			setTimeout(() => {	connection.close();	}, 500);
		}

		throw new Error(error);
	}
}

export default setupConnection;
