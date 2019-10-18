import { Router } from 'express';
import { textValidationRules, validate } from '../middlewares/validator';
import textTranslator from './textTranslator';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate', textValidationRules, validate, textTranslator);

export default textTranslatorRoute;
