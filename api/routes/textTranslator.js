import express from 'express';
import { check } from 'express-validator/check';
import translator from '../controllers/textTranslator';

const translatorRouter = express.Router();

translatorRouter.post('/translate', check('text').not().isEmpty(), translator);

export default translatorRouter;
