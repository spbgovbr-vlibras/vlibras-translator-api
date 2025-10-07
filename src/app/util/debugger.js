// src/app/util/debugger.js
import morgan from 'morgan';
import express from 'express';
import { context, trace } from '@opentelemetry/api';

const now = () => new Date().toISOString();
const devEnabled = () => (process.env.LOGGER_FORMAT || '').toLowerCase() === 'dev';
const MAX_REQ_LOG_BYTES = Number(process.env.MAX_REQ_LOG_BYTES || 8192);
const MAX_RES_LOG_BYTES = Number(process.env.MAX_RES_LOG_BYTES || 8192);
const NS = 'vlibras-translator-api';

function jsonClamp(obj, maxBytes) {
  try {
    let s = JSON.stringify(obj ?? {});
    if (Buffer.byteLength(s) > maxBytes) s = s.slice(0, maxBytes) + '...';
    return s;
  } catch {
    return '[unserializable]';
  }
}

function log(level, payload) {
  const line = JSON.stringify({ ts: now(), level, ...payload });
  const colors = {
    info: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    debug: '\x1b[36m',
    reset: '\x1b[0m'
  };
  const coloredLine = `${colors[level] || colors.reset}${line}${colors.reset}`;
  if (level === 'error') console.error(coloredLine);
  else console.log(coloredLine);
}

export function applyDevLogging(app) {
  app.use(express.json({ limit: process.env.JSON_LIMIT || '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: process.env.URLENC_LIMIT || '2mb' }));

  if (!devEnabled()) return;

  app.use(morgan('dev'));

  app.use((req, res, next) => {
    const start = Date.now();
    const span = trace.getSpan(context.active());
    const sc = span?.spanContext?.();

    log('debug', {
      kind: 'http_request',
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      headers: req.headers,
      body: jsonClamp(req.body, MAX_REQ_LOG_BYTES),
      trace_id: sc?.traceId,
      span_id: sc?.spanId,
    });

    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    let capturedBody;

    res.json = (body) => { capturedBody = body; return origJson(body); };
    res.send = (body) => { capturedBody = body; return origSend(body); };

    res.on('finish', () => {
      let out;
      if (capturedBody === undefined) {
        out = undefined;
      } else if (Buffer.isBuffer(capturedBody)) {
        out = capturedBody.toString('utf8');
        if (Buffer.byteLength(out) > MAX_RES_LOG_BYTES) out = out.slice(0, MAX_RES_LOG_BYTES) + '...';
      } else if (typeof capturedBody === 'string') {
        out = Buffer.byteLength(capturedBody) > MAX_RES_LOG_BYTES
          ? capturedBody.slice(0, MAX_RES_LOG_BYTES) + '...'
          : capturedBody;
      } else {
        out = jsonClamp(capturedBody, MAX_RES_LOG_BYTES);
      }

      log('debug', {
        kind: 'http_response',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Date.now() - start,
        body: out,
        trace_id: sc?.traceId,
        span_id: sc?.spanId,
      });
    });

    next();
  });
}

export const serverInfo  = (msg, meta = {}) => log('info',  { ns: NS, msg, ...meta });
export const serverWarn  = (msg, meta = {}) => log('warn',  { ns: NS, msg, ...meta });
export const serverError = (msg, meta = {}) => log('error', { ns: NS, msg, ...meta });

export const cacheError    = (msg, meta = {}) => log('error', { ns: `${NS}:cache`, msg, ...meta });
export const databaseError = (msg, meta = {}) => log('error', { ns: `${NS}:db`, msg, ...meta });
