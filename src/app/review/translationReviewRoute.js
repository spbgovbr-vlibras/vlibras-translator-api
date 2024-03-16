import { Router } from 'express';
import { reviewValidationRules, checkValidation } from '../middlewares/validator.js';
import translationReview from './translationReview.js';

const translationReviewRoute = Router();

translationReviewRoute.post('/review',
  reviewValidationRules,
  checkValidation,
  translationReview);

export default translationReviewRoute;
