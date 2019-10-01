import express from 'express';
import { check } from 'express-validator/check';
import translator from '../controllers/textTranslator';

const translatorRouter = express.Router();

translatorRouter.post('/translate', 
	check('text').isLength({ min: 1, max: 5000 }),
	translator);

export default translatorRouter;
