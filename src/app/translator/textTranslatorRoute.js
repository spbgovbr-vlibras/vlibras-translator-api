import { Router } from 'express';
import { textValidationRules, checkValidation } from '../middlewares/validator.js';
import translationCache from '../middlewares/translationCache.js';
import { textTranslator, sentimentTranslator } from './textTranslator.js';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate',
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator);

textTranslatorRoute.post('/translatesentiment',
  textValidationRules,
  checkValidation,
  translationCache,
  sentimentTranslator);

export default textTranslatorRoute;
