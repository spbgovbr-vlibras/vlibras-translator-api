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
		const queueConnection = await setupConnection();
		const connectionChannel = await queueConnection.createChannel();

		const { consumerCount } = await connectionChannel.assertQueue(process.env.TRANSLATOR_QUEUE);

		if (consumerCount === 0) {
			return next(createError(500, "Translation Core Unavailable"));
		}

		const translationRequest = new Translation({
			text: req.body.text,
			requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress
		});

		connectionChannel.consume(
			process.env.API_CONSUMER_QUEUE,
			(msg) => {
				if (msg.properties.correlationId === uid) {
					const content = JSON.parse(msg.content.toString())

					if (content.error !== undefined) {
						return next(createError(500, content.error));
					}
					
					res.status(200).send(content.translation);
					setTimeout(() => { connectionChannel.close(); }, 500);

					Translation.findByIdAndUpdate(
						translationRequest._id, 
						{ translation: content.translation }
					).exec();
				}
			},
			{ noAck: true }
		);

		const payload = JSON.stringify({ text: req.body.text });
		
		await connectionChannel.publish(
			'',
			process.env.TRANSLATOR_QUEUE,
			Buffer.from(payload),
			{ correlationId: uid, replyTo: process.env.API_CONSUMER_QUEUE }
		);

		await translationRequest.save();

	} catch (error) {
		next(error);
	}
	
}

export default translator;