import createError from 'http-errors';
import uuid from 'uuid/v4';
import { validationResult } from 'express-validator/check';
import setupConnection from '../helpers/queueConnection';
import env from '../config/environments/environment';
import { CHANNEL_CLOSE_TIMEOUT, TRANSLATION_TIMEOUT } from '../config/timeout';
import { TRANSLATION_MESSAGE_TTL } from '../config/timeout';
import { TRANSLATION_CORE_ERROR } from '../config/error';
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

		const { consumerCount } = await connectionChannel.assertQueue(
			env.TRANSLATOR_QUEUE, 
			{ durable: false });

		if (consumerCount === 0) {
			return next(createError(500, TRANSLATION_CORE_ERROR.unavailable));
		}

		const translationRequest = new Translation({
			text: req.body.text,
			requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress
		});

		connectionChannel.consume(
			env.API_CONSUMER_QUEUE,
			(msg) => {
				if (msg.properties.correlationId === uid) {
					const content = JSON.parse(msg.content.toString())

					if (content.error !== undefined) {
						return next(createError(500, content.error));
					}
					
					res.status(200).send(content.translation);

					setTimeout(() => { 
						try {
							connectionChannel.close();

						} catch (channelAlreadyClosedError) {}

					 }, CHANNEL_CLOSE_TIMEOUT);

					Translation.findByIdAndUpdate(
						translationRequest._id, 
						{ translation: content.translation }
					).exec();
				}
			},
			{ noAck: true }
		);

		setTimeout(() => {
			if(!res.headersSent) {
				try {
					connectionChannel.close();

				} catch (channelAlreadyClosedError) {}

				return next(createError(408, TRANSLATION_CORE_ERROR.timeout));
			}
		}, TRANSLATION_TIMEOUT);

		const payload = JSON.stringify({ text: req.body.text });

		await connectionChannel.publish(
			'',
			env.TRANSLATOR_QUEUE,
			Buffer.from(payload),
			{ correlationId: uid,
				replyTo: env.API_CONSUMER_QUEUE,
				expiration: TRANSLATION_MESSAGE_TTL
			}
		);

		await translationRequest.save();

	} catch (error) {
		next(error);
	}

}

export default translator;
