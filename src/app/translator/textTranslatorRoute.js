import { Router } from 'express';
import { textValidationRules, checkValidation } from '../middlewares/validator.js';
import translationCache from '../middlewares/translationCache.js';
import { textTranslator, textTranslatorTest } from './textTranslator.js';

const textTranslatorRoute = Router();

textTranslatorRoute.post(
  '/translate',
  textValidationRules,
  checkValidation,
  translationCache,
  textTranslator
);

textTranslatorRoute.post('/test', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "O campo 'text' é obrigatório." });
    }

    const result = await textTranslatorTest(text);
    return res.status(200).json(result); 
  } catch (error) {
    console.error("Erro na rota /translator/test:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

export default textTranslatorRoute;
