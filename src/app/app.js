import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

import env from '../config/environments/environment.js';

import apiDocRoute from './doc/apiDocRoute.js';
import reviewRoute from './review/translationReviewRoute.js';
import translatorRoute from './translator/textTranslatorRoute.js';
import videoMakerRoute from './video/videoMakerRoute.js';
import metricsRoute from './metrics/metricsRoute.js';
import healthRouter from './health/healthRoute.js'

const app = express();

app.use(cors());
app.use(compression());
app.use(helmet());
app.use(logger(env.LOGGER_FORMAT || 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', apiDocRoute);
app.use('/', reviewRoute);
app.use('/', translatorRoute);
app.use('/', videoMakerRoute);
app.use('/', metricsRoute);
app.use('/', healthRouter);

app.get('/healthcheck', (_req, res) => {
  res.sendStatus(200);
});

app.use((_req, _res, next) => {
  next(createError(404));
});

app.use((err, _req, res, _next) => {
  res.status(err.status || 500);

  if (app.get('env') === 'dev') {
    console.error('\x1b[2m', err, '\x1b[0m');
    return res.json({ error: err });
  }

  if (err.status === 422) {
    return res.json({ error: err.errors });
  }

  return res.json({ error: err.message });
});

export default app;
