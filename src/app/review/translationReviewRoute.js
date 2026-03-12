import { Router } from 'express';
import { reviewValidationRules, checkValidation } from '../middlewares/validator.js';
import translationReview from './translationReview.js';
import reviewStats from './reviewStats.js';

const translationReviewRoute = Router();

translationReviewRoute.post('/review',
  reviewValidationRules,
  checkValidation,
  translationReview);

translationReviewRoute.get('/review/stats', reviewStats);

export default translationReviewRoute;
