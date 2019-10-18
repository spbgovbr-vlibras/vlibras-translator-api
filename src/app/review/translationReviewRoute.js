import { Router } from 'express';
import { reviewValidationRules, validate } from '../middlewares/validator';
import translationReview from './translationReview';

const translationReviewRoute = Router();

translationReviewRoute.post('/review', reviewValidationRules, validate, translationReview);

export default translationReviewRoute;
