import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';

const swaggerDoc = JSON.parse(fs.readFileSync('./src/app/doc/openapi.json', 'utf8'));

const options = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'VLibras Docs',
};

const apiDocRoute = Router();

apiDocRoute.use('/', swaggerUi.serve);
apiDocRoute.get('/docs', swaggerUi.setup(swaggerDoc, options));

export default apiDocRoute;
