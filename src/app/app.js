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
import metricsRoute from './metrics/metricsRoute.js';
import healthRouter from './health/healthRoute.js';
import { attachUid } from './middlewares/attachUid.js';

const app = express();
const parseAllowedOrigins = (allowedOrigins = '') => allowedOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const createCorsOptions = ({ allowedOrigins = [], allowAllIfEmpty = false } = {}) => ({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowAllIfEmpty && allowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(createError(403, 'Origin not allowed by CORS'));
  },
});
const appAllowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
const healthAllowedOrigins = parseAllowedOrigins(env.HEALTH_CORS_ALLOWED_ORIGINS);
const metricsAllowedOrigins = parseAllowedOrigins(env.METRICS_CORS_ALLOWED_ORIGINS);
const appCors = cors(createCorsOptions({
  allowedOrigins: appAllowedOrigins,
  allowAllIfEmpty: true,
}));

app.set('etag', false);
app.use((req, res, next) => {
  if (req.path === '/metrics' || req.path === '/health') {
    next();
    return;
  }

  appCors(req, res, next);
});
app.use(compression());
app.use(helmet());
app.use(logger(env.LOGGER_FORMAT || 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(attachUid);

app.use('/', apiDocRoute);
app.use('/', reviewRoute);
app.use('/', translatorRoute);
app.use(
  '/',
  cors(createCorsOptions({ allowedOrigins: metricsAllowedOrigins })),
  metricsRoute,
);
app.use(
  '/',
  cors(createCorsOptions({ allowedOrigins: healthAllowedOrigins })),
  healthRouter,
);

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
