import { Router } from 'express';
import { textValidationRules, checkValidation } from '../middlewares/validator';
import translationCache from '../middlewares/translationCache';
import textTranslator from './textTranslator';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate',
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator);

export default textTranslatorRoute;
