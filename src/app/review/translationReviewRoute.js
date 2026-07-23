import { Router } from 'express';
import { reviewValidationRules } from '../middlewares/validator.js';
import translationReview from './translationReview.js';
import reviewStats from './reviewStats.js';

const translationReviewRoute = Router();

translationReviewRoute.post(
  '/review',
  reviewValidationRules,
  translationReview,
);

translationReviewRoute.get('/review/stats', reviewStats);

export default translationReviewRoute;
