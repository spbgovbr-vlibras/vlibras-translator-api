import { Router } from 'express';

import metrics from './metrics';

const metricsRouter = Router();

metricsRouter.get('/metrics', metrics);

export default metricsRouter;
