import express from 'express';

const healthRouter = express.Router();

healthRouter.get('/healthcheck', (req, res) => {
    res.sendStatus(200);
});

export default healthRouter;
