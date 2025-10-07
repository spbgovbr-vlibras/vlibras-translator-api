import createError from 'http-errors';
import { checkSchema, validationResult } from 'express-validator';
import { VALIDATION_VALUES, VALIDATION_ERRORS } from '../../config/validation.js';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('vlibras-translator-api');

const firstErrorOnly = (req) => validationResult(req).array({ onlyFirstError: true });

const normalizeMsg = (msg, fallback) => {
  if (typeof msg === 'object' && msg) {
    const { code, httpStatus, message } = msg;
    return {
      code: String(code || fallback.code),
      httpStatus: Number(httpStatus || fallback.httpStatus),
      message: String(message || fallback.message),
    };
  }
  return { ...fallback, message: String(msg || fallback.message) };
};

const formatErrors = (errs) =>
  errs.map((err) => {
    const base = { code: 'VALIDATION_ERROR', httpStatus: 422, message: 'Validation error' };
    const m = normalizeMsg(err.msg, base);
    return {
      field: err.path || err.param || 'unknown',
      location: err.location || 'body',
      code: m.code,
      httpStatus: m.httpStatus,
      message: m.message,
    };
  });

const aggregateStatus = (errors) => (errors.some((e) => e.httpStatus === 400) ? 400 : 422);

export const textValidationRules = checkSchema({
  text: {
    in: ['body'],
    exists: {
      options: { checkFalsy: true },
      errorMessage: { code: 'TEXT_REQUIRED', httpStatus: 400, message: VALIDATION_ERRORS.notFoundText },
      bail: true,
    },
    isString: {
      errorMessage: { code: 'TEXT_TYPE', httpStatus: 400, message: "'text' must be a string." },
      bail: true,
    },
    trim: true,
    isLength: {
      options: VALIDATION_VALUES.textLength,
      errorMessage: { code: 'TEXT_LENGTH', httpStatus: 422, message: VALIDATION_ERRORS.textLength },
    },
  },
});

export const idValidationRules = checkSchema({
  requestUID: {
    in: ['params'],
    exists: {
      options: { checkFalsy: true },
      errorMessage: { code: 'UUID_REQUIRED', httpStatus: 400, message: 'requestUID is required.' },
      bail: true,
    },
    isUUID: {
      options: 4,
      errorMessage: { code: 'UUID_V4_INVALID', httpStatus: 400, message: VALIDATION_ERRORS.uuidVersion },
    },
  },
});

export const timestampValidationRules = checkSchema({
  startTime: {
    in: ['query'],
    optional: true,
    isInt: {
      options: VALIDATION_VALUES.dateInterval,
      errorMessage: { code: 'START_TIME_RANGE', httpStatus: 400, message: VALIDATION_ERRORS.dateInterval },
    },
    toInt: true,
  },
  endTime: {
    in: ['query'],
    optional: true,
    isInt: {
      options: VALIDATION_VALUES.dateInterval,
      errorMessage: { code: 'END_TIME_RANGE', httpStatus: 400, message: VALIDATION_ERRORS.dateInterval },
    },
    toInt: true,
  },
  _coherence: {
    custom: {
      options: (_val, { req }) => {
        const s = req.query.startTime;
        const e = req.query.endTime;
        if (s !== undefined && e !== undefined && Number(s) > Number(e)) {
          throw { code: 'TIME_INTERVAL_INVALID', httpStatus: 400, message: 'startTime must be <= endTime' };
        }
        return true;
      },
    },
  },
});

export const reviewValidationRules = checkSchema({
  text: {
    in: ['body'],
    exists: {
      options: { checkFalsy: true },
      errorMessage: { code: 'TEXT_REQUIRED', httpStatus: 400, message: VALIDATION_ERRORS.notFoundText },
      bail: true,
    },
    isString: {
      errorMessage: { code: 'TEXT_TYPE', httpStatus: 400, message: "'text' must be a string." },
      bail: true,
    },
    trim: true,
    isLength: {
      options: VALIDATION_VALUES.textLength,
      errorMessage: { code: 'TEXT_LENGTH', httpStatus: 422, message: VALIDATION_ERRORS.textLength },
    },
  },
  translation: {
    in: ['body'],
    exists: {
      options: { checkFalsy: true },
      errorMessage: { code: 'TRANSLATION_REQUIRED', httpStatus: 400, message: VALIDATION_ERRORS.notFoundTranslation },
      bail: true,
    },
    isString: {
      errorMessage: { code: 'TRANSLATION_TYPE', httpStatus: 400, message: "'translation' must be a string." },
      bail: true,
    },
    trim: true,
    isLength: {
      options: VALIDATION_VALUES.textLength,
      errorMessage: { code: 'TRANSLATION_LENGTH', httpStatus: 422, message: VALIDATION_ERRORS.translationLength },
    },
  },
  rating: {
    in: ['body'],
    exists: {
      errorMessage: { code: 'RATING_REQUIRED', httpStatus: 400, message: 'rating is required.' },
      bail: true,
    },
    isIn: {
      options: [VALIDATION_VALUES.ratingOptions],
      errorMessage: { code: 'RATING_INVALID', httpStatus: 422, message: VALIDATION_ERRORS.ratingOptions },
    },
  },
});

export const checkValidation = function checkRequestValidation(req, _res, next) {
  const span = tracer.startSpan('validation.check', {
    attributes: {
      'validation.route': req.route?.path || 'unknown',
      'validation.method': req.method,
    },
  });

  try {
    const errs = firstErrorOnly(req);
    if (errs.length === 0) {
      span.setAttribute('validation.errors_count', 0);
      span.end();
      return next();
    }

    const extracted = formatErrors(errs);
    const status = aggregateStatus(extracted);

    span.setAttribute('validation.errors_count', extracted.length);
    span.setAttribute('validation.http_status', status);
    span.setAttribute('validation.invalid_fields', extracted.map((e) => e.field).join(','));
    extracted.forEach((e, i) => {
      span.addEvent('validation.error', {
        idx: i,
        field: e.field,
        code: e.code,
        httpStatus: e.httpStatus,
        message: e.message.slice(0, 512),
      });
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: `${status} validation failure` });

    const activeSpan = trace.getSpan(context.active());
    const sc = activeSpan?.spanContext?.();
    const payload = {
      level: 'warn',
      ts: new Date().toISOString(),
      kind: 'validation',
      http: {
        method: req.method,
        path: req.originalUrl,
        status,
      },
      trace: {
        trace_id: sc?.traceId,
        span_id: sc?.spanId,
      },
      errors: extracted, // [{field, location, code, httpStatus, message}]
    };
    console.error(JSON.stringify(payload)); // log estruturado

    span.end();
    return next(createError(status, { errors: extracted }));
  } catch (e) {
    const activeSpan = trace.getSpan(context.active());
    const sc = activeSpan?.spanContext?.();
    console.error(JSON.stringify({
      level: 'error',
      ts: new Date().toISOString(),
      kind: 'validation-exception',
      http: { method: req.method, path: req.originalUrl },
      trace: { trace_id: sc?.traceId, span_id: sc?.spanId },
      error: { message: String(e?.message || e), stack: e?.stack },
    }));
    span.recordException(e);
    span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    span.end();
    return next(e);
  }
};