import createError from 'http-errors';
import uuid from 'uuid/v4';
import { validationResult } from 'express-validator/check';
import setupConnection from '../helpers/queueConnection';
import Translation from '../models/translation';

const translator = async function textTranslator(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	try {
		const uid = uuid();
		const connectionChannel = await setupConnection();

		await connectionChannel.assertExchange(
			process.env.EXCHANGE_NAME,
			process.env.EXCHANGE_TYPE,
			{ durable: true }
		);

		connectionChannel.consume(
			process.env.CONSUMER_QUEUE,
			(msg) => {
				if (msg.properties.correlationId === uid) {
					res.status(200).json(msg.content.toString());
					setTimeout(() => { connectionChannel.close(); }, 500);
				}
			},
			{ noAck: true }
		);

		const payload = JSON.stringify({ text: req.body.text });
		
		await connectionChannel.publish(
			process.env.EXCHANGE_NAME,
			process.env.TEXT_ROUTE,
			Buffer.from(payload),
			{ correlationId: uid, replyTo: process.env.CONSUMER_QUEUE }
		);

		const translationRequest = new Translation({
			text: req.body.text,
			requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress
		});

		await translationRequest.save();

	} catch (error) {
		next(error);
	}
	
}

export default translator;