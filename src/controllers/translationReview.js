import createError from 'http-errors';
import { validationResult } from 'express-validator/check';
import Review from '../models/review';

const review = async function translationReview(req, res, next) {

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		return next(createError(422, errors.array()));
	}

	try {
		const reviewRequest = new Review({
			text: req.body.text,
			translation: req.body.translation,
			rating: req.body.rating,
			review: req.body.review || '',
			requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress
		});

		await reviewRequest.save();

		res.sendStatus(200);

	} catch (error) {
		next(error);
	}

}

export default review;
