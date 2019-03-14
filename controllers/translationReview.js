import createError from 'http-errors';
import { validationResult } from 'express-validator/check';
import Review from '../models/review';

const review = async function textTranslator(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	const payload = {
		text: req.body.text,
		translation: req.body.translation,
		rating: req.body.rating,
		review: req.body.review
	};

	res.status(200).json(payload);	
}

export default review;