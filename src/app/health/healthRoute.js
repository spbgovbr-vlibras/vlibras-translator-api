import { Router } from 'express';
import { healthLimiter } from '../middlewares/rateLimiter.js';
import health from './health.js';
import { textTranslatorHealth } from '../translator/textTranslator.js';

const healthRouter = Router();

healthRouter.get('/health', healthLimiter, async (req, res, next) => {
    try {
        req.body = { text: "Ola mundo da vida" };

        const content = await textTranslatorHealth(req, res, next);

        return health(req, res, content);
    } catch (error) {
        next(error);
    }
});

export default healthRouter;
