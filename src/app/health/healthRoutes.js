import { Router } from 'express';
import health from './health';

const healthRouter = Router();

healthRouter.get('/health', health);

export default healthRouter;
