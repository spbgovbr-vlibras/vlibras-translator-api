import createError from 'http-errors';
import uuid from 'uuid/v4';
import { validationResult } from 'express-validator/check';

import { sendToQueue } from '../helpers/queueWrapper';

const translator = async function textTranslator(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	const id = uuid();

	try {
		await sendToQueue(process.env.TEXT_ROUTE, req.body.text, id);
		res.status(200).json(req.body.text);
	} catch (error) {
		next(error);
	}
	
}

export default translator;