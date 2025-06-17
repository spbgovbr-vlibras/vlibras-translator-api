import { Router } from 'express';
import {health, healthv2} from './health.js';
import {textTranslatorHealth} from '../translator/textTranslator.js';

const healthRouter = Router();

healthRouter.get('/health', health);

healthRouter.get('/health/v2', async (req, res, next) => {
    try {
        req.body = { text: "Ola mundo da vida" };

        const content = await textTranslatorHealth(req, res, next);

        return healthv2(req, res, content);
    } catch (error) {
        next(error);
    }
});


export default healthRouter;
