import { Router } from 'express';
import { reviewValidationRules, checkValidation } from '../middlewares/validator.js';
import { validateTranslationReviewSecure } from '../middlewares/secureReview.js';
import { reviewLimiter } from '../middlewares/rateLimiter.js';
import translationReview from './translationReview.js';

const translationReviewRoute = Router();

translationReviewRoute.post('/review',
  reviewLimiter,
  reviewValidationRules,
  checkValidation,
  validateTranslationReviewSecure({ minSimilarity: 0.5, maxSimilarity: 0.99, maxLength: 5000 }),
  translationReview);

export default translationReviewRoute;
