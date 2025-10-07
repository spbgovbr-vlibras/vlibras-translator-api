import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { context, trace } from '@opentelemetry/api';
import env from '../config/environments/environment.js';

import apiDocRoute from './doc/apiDocRoute.js';
import reviewRoute from './review/translationReviewRoute.js';
import translatorRoute from './translator/textTranslatorRoute.js';
import metricsRoute from './metrics/metricsRoute.js';
import healthRouter from './health/healthRoute.js';
import { attachUid } from './middlewares/attachUid.js';

const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(cookieParser());

if ((env.LOGGER_FORMAT || 'combined').toLowerCase() === 'dev') {
  app.use(logger('dev'));

  app.use((req, res, next) => {
    const start = Date.now();
    const span = trace.getSpan(context.active());
    const sc = span?.spanContext?.();

    console.debug(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'debug',
      kind: 'http_request',
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      headers: req.headers,
      body: req.body,
      trace_id: sc?.traceId,
      span_id: sc?.spanId,
    }));

    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    let captured;

    res.json = (body) => { captured = body; return origJson(body); };
    res.send = (body) => { captured = body; return origSend(body); };

    res.on('finish', () => {
      let out = captured;
      if (Buffer.isBuffer(out)) out = out.toString('utf8');
      console.debug(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'debug',
        kind: 'http_response',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        body: out,
        trace_id: sc?.traceId,
        span_id: sc?.spanId,
      }));
    });

    next();
  });
} else {
  app.use(logger(env.LOGGER_FORMAT || 'combined'));
}

app.use(cors());
app.use(compression());
app.use(helmet());

app.use((req, res, next) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const sc = span.spanContext();
    res.setHeader('traceparent', `00-${sc.traceId}-${sc.spanId}-01`);
    res.setHeader('x-trace-id', sc.traceId);
  }
  next();
});

app.use(attachUid);

app.get('/healthcheck', (_req, res) => res.sendStatus(200));

app.use('/', apiDocRoute);
app.use('/', reviewRoute);
app.use('/', translatorRoute);
app.use('/', metricsRoute);
app.use('/', healthRouter);

app.use((_req, _res, next) => next(createError(404)));

app.use((err, _req, res, _next) => {
  res.status(err.status || 500);
  if ((env.LOGGER_FORMAT || '').toLowerCase() === 'dev') {
    console.error(err);
    return res.json({ error: err });
  }
  if (err.status === 422) return res.json({ error: err.errors });
  return res.json({ error: err.message });
});

export default app;
