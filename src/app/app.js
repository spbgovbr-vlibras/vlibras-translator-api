import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import createError from 'http-errors';

import env from '../config/environments/environment.js';

import apiDocRoute from './doc/apiDocRoute.js';
import reviewRoute from './review/translationReviewRoute.js';
import translatorRoute from './translator/textTranslatorRoute.js';
import metricsRoute from './metrics/metricsRoute.js';
import healthRouter from './health/healthRoute.js';
import { attachUid } from './middlewares/attachUid.js';
import createApiKeyAuthMiddleware from './middlewares/apiKeyAuth.js';
import { createCorsOptions, parseAllowedOrigins } from './middlewares/corsOptions.js';
import { createRateLimitMiddleware } from './middlewares/rateLimit.js';
import logger from './util/logger.js';

const app = express();
const appAllowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
const healthAllowedOrigins = parseAllowedOrigins(env.HEALTH_CORS_ALLOWED_ORIGINS);
const metricsAllowedOrigins = parseAllowedOrigins(env.METRICS_CORS_ALLOWED_ORIGINS);
const appCors = cors(createCorsOptions({
  allowedOrigins: appAllowedOrigins,
  allowAllIfEmpty: true,
}));
const {
  generalRateLimit,
  translateRateLimit,
} = createRateLimitMiddleware(env);
const apiKeyAuth = createApiKeyAuthMiddleware(env);

app.disable('x-powered-by');
app.set('etag', false);
app.set('trust proxy', env.TRUST_PROXY === 'true');
app.use((req, res, next) => {
  if (req.path === '/metrics' || req.path === '/health' || req.path === '/status') {
    next();
    return;
  }

  appCors(req, res, next);
});
app.use(compression());
app.use(helmet());
app.use(attachUid);
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.uid,
  // req.log carrega só o reqId (= req.uid), sem repetir a requisição inteira em cada linha.
  quietReqLogger: true,
  // Os headers de resposta (helmet, rate limit) só inflam a linha de log.
  serializers: {
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (
    req.path === '/translate'
    || req.path === '/translatesentiment'
    || req.path.startsWith('/refine')
  ) {
    next();
    return;
  }

  generalRateLimit(req, res, next);
});

app.use('/', apiDocRoute);
app.use('/', reviewRoute);
app.use('/translate', translateRateLimit);
app.use('/translatesentiment', translateRateLimit);
app.use('/refine', translateRateLimit);
app.use('/', translatorRoute);
app.use(
  '/',
  apiKeyAuth,
  cors(createCorsOptions({ allowedOrigins: metricsAllowedOrigins, allowAllIfEmpty: true })),
  metricsRoute,
);
app.use(
  '/',
  apiKeyAuth,
  cors(createCorsOptions({ allowedOrigins: healthAllowedOrigins, allowAllIfEmpty: true })),
  healthRouter,
);

app.get('/healthcheck', apiKeyAuth, (_req, res) => {
  res.sendStatus(200);
});

app.use((_req, _res, next) => {
  next(createError(404));
});

app.use((err, _req, res, _next) => {
  const statusCode = err.status || 500;
  res.status(statusCode);

  if (statusCode >= 500) {
    // O pino-http anexa res.err ao log de resposta da requisição.
    res.err = err;
  }

  if (err.errors) {
    return res.json({ error: err.errors });
  }

  return res.json({ error: err.message });
});

export default app;
