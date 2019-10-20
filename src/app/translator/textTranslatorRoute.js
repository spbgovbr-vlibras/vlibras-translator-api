import { Router } from 'express';
import { textValidationRules, checkValidation } from '../middlewares/validator';
import textTranslator from './textTranslator';

const textTranslatorRoute = Router();

textTranslatorRoute.post('/translate', textValidationRules, checkValidation, textTranslator);

export default textTranslatorRoute;
