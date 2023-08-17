import { Router } from 'express';
import { textValidationRules, checkValidation, filterTextTranslateRules } from '../middlewares/validator';
import translationCache from '../middlewares/translationCache';
import textTranslator from './textTranslator';
import fliterTextTranslate from './fliterTextTranslate';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate',
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator);

textTranslatorRoute.get('/translate',
  filterTextTranslateRules,
  checkValidation,
  fliterTextTranslate);

export default textTranslatorRoute;
