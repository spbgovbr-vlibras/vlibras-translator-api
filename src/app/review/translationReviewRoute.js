import { Router } from 'express';
import { reviewValidationRules, checkValidation } from '../middlewares/validator';
import translationReview from './translationReview';

const translationReviewRoute = Router();

translationReviewRoute.post('/review',
  reviewValidationRules,
  checkValidation,
  translationReview);

export default translationReviewRoute;
