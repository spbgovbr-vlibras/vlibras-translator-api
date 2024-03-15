import { Router } from 'express';
import health from './health.js';

const healthRouter = Router();

healthRouter.get('/health', health);

export default healthRouter;
