import { Router } from 'express';
import { timestampValidationRules, checkValidation } from '../middlewares/validator.js';
import { healthLimiter } from '../middlewares/rateLimiter.js';
import metrics from './metrics.js';

const metricsRouter = Router();

metricsRouter.get('/metrics',
  healthLimiter,
  timestampValidationRules,
  checkValidation,
  metrics);

export default metricsRouter;
