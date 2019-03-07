import createError from 'http-errors';
import uuid from 'uuid/v4';
import { validationResult } from 'express-validator/check';
import { sendToQueue } from '../helpers/queueWrapper';
import Translation from '../models/translation';

const translator = async function textTranslator(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	try {
		const uid = uuid();

		await sendToQueue(process.env.TEXT_ROUTE, req.body.text, uid);
		
		const translationRequest = new Translation({
			requestTag: uid,
			text: req.body.text
		});

		await translationRequest.save();

		res.status(200).json(req.body.text);
		
	} catch (error) {
		next(error);
	}
	
}

export default translator;