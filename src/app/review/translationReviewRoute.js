import express, { Router } from 'express';
import { reviewValidationRules, checkValidation } from '../middlewares/validator.js';
import translationReview from './translationReview.js';

const translationReviewRoute = Router();

translationReviewRoute.post('/review',
  express.json({ limit: '128kb' }),
  express.urlencoded({ extended: true, limit: '128kb' }),
  reviewValidationRules,
  checkValidation,
  translationReview);

export default translationReviewRoute;
