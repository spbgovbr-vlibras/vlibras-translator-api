import { Router } from 'express';
import health from './health.js';
import { textTranslatorHealth } from '../translator/textTranslator.js';

const healthRouter = Router();

healthRouter.get('/health', async (req, res, next) => {
  try {
    req.body = { text: 'Ola mundo da vida' };
    let content;

    try {
      content = await textTranslatorHealth(req, res, () => undefined);
    } catch (error) {
      content = undefined;
    }

    return health(req, res, content);
  } catch (error) {
    return next(error);
  }
});

export default healthRouter;
