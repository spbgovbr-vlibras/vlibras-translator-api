import { Router } from 'express';
import { timestampValidationRules, checkValidation } from '../middlewares/validator.js';
import metrics from './metrics.js';

const metricsRouter = Router();

metricsRouter.get('/metrics',
  timestampValidationRules,
  checkValidation,
  metrics);

export default metricsRouter;
