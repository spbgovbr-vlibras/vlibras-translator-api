import { Router } from 'express';
import { textValidationRules, checkValidation } from '../middlewares/validator.js';
import translationCache from '../middlewares/translationCache.js';
import textTranslator from './textTranslator.js';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate',
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator);

export default textTranslatorRoute;
