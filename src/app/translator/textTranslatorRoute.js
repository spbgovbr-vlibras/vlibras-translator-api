import express, { Router } from 'express';
import { textValidationRules, checkValidation } from '../middlewares/validator.js';
import translationCache from '../middlewares/translationCache.js';
import { textTranslator } from './textTranslator.js';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate',
  express.json({ limit: '128kb' }),
  express.urlencoded({ extended: true, limit: '128kb' }),
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator);

export default textTranslatorRoute;
