import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerDoc from '../docs/openapi.json';

const options = { 
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VLibras Docs'
};

const apiDocRouter = express.Router();

apiDocRouter.use('/', swaggerUi.serve);
apiDocRouter.get('/docs', swaggerUi.setup(swaggerDoc, options));

export default apiDocRouter;
