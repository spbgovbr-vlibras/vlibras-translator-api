import amqplib from 'amqplib';
import env from '../config/environments/environment';

let connection;

const connectionURL = {
	protocol: env.AMQP_PROTOCOL,
	hostname: env.AMQP_HOST,
	port: env.AMQP_PORT,
	username: env.AMQP_USER,
	password: env.AMQP_PASS
};

const setupConnection = async function setupQueueConnection() {
	try {
		if (connection === undefined) {		
			connection = await amqplib.connect(connectionURL);
			connection.on('close', () => {
				connection = undefined;
				return setTimeout(() => { setupConnection(); }, 500);
			});
		}

		return connection;

	} catch (error) {
		if (connection !== undefined) {
			setTimeout(() => {	connection.close();	}, 500);
		}

		throw new Error(error);
	}
}

export default setupConnection;
