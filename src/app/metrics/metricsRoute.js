import { Router } from 'express';
import { timestampValidationRules, checkValidation } from '../middlewares/validator';
import metrics from './metrics';

const metricsRouter = Router();

metricsRouter.get('/metrics',
  timestampValidationRules,
  checkValidation,
  metrics);

export default metricsRouter;
