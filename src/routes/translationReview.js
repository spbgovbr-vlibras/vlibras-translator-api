import express from 'express';
import { check } from 'express-validator/check';
import review from '../controllers/translationReview';

const reviewRouter = express.Router();

reviewRouter.post('/review', [
	check('text').isLength({ min: 1, max: 5000 }),
	check('translation').isLength({ min: 1, max: 5000 }),
	check('rating').matches(/^good$|^bad$/)
], review);

export default reviewRouter;
