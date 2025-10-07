export const TRANSLATOR_ERROR = {
  unavailable: 'Translation Core Unavailable',
  wrongResponse: 'Translation Core response message has invalid properties',
  timeout: 'Translation Core Timeout',
  translationError: 'Problem during translation process',
};

export const METRICS_ERROR = {
  metricsError: 'Failed to access metrics',
};

export const REVIEW_ERROR = {
  reviewError: 'Failed to publish review.',
};

export const DOMAIN_ERROR_CODES = {
  TRANSLATION_CORE_UNAVAILABLE: 'TRANSLATION_CORE_UNAVAILABLE',
  TRANSLATION_CORE_INVALID_RESPONSE: 'TRANSLATION_CORE_INVALID_RESPONSE',
  TRANSLATION_CORE_TIMEOUT: 'TRANSLATION_CORE_TIMEOUT',
  TRANSLATION_PROCESS_FAILED: 'TRANSLATION_PROCESS_FAILED',
  METRICS_UNAVAILABLE: 'METRICS_UNAVAILABLE',
  REVIEW_PUBLISH_FAILED: 'REVIEW_PUBLISH_FAILED',
};

export const DOMAIN_ERROR_MESSAGES = {
  TRANSLATION_CORE_UNAVAILABLE: TRANSLATOR_ERROR.unavailable,
  TRANSLATION_CORE_INVALID_RESPONSE: TRANSLATOR_ERROR.wrongResponse,
  TRANSLATION_CORE_TIMEOUT: TRANSLATOR_ERROR.timeout,
  TRANSLATION_PROCESS_FAILED: TRANSLATOR_ERROR.translationError,
  METRICS_UNAVAILABLE: METRICS_ERROR.metricsError,
  REVIEW_PUBLISH_FAILED: REVIEW_ERROR.reviewError,
};

export const API_ERROR_CATALOG_DOMAIN = {
  TRANSLATION_CORE_UNAVAILABLE: { status: 503, title: 'Service Unavailable', message: DOMAIN_ERROR_MESSAGES.TRANSLATION_CORE_UNAVAILABLE },
  TRANSLATION_CORE_INVALID_RESPONSE: { status: 502, title: 'Bad Gateway', message: DOMAIN_ERROR_MESSAGES.TRANSLATION_CORE_INVALID_RESPONSE },
  TRANSLATION_CORE_TIMEOUT: { status: 504, title: 'Gateway Timeout', message: DOMAIN_ERROR_MESSAGES.TRANSLATION_CORE_TIMEOUT },
  TRANSLATION_PROCESS_FAILED: { status: 500, title: 'Internal Server Error', message: DOMAIN_ERROR_MESSAGES.TRANSLATION_PROCESS_FAILED },
  METRICS_UNAVAILABLE: { status: 503, title: 'Service Unavailable', message: DOMAIN_ERROR_MESSAGES.METRICS_UNAVAILABLE },
  REVIEW_PUBLISH_FAILED: { status: 500, title: 'Internal Server Error', message: DOMAIN_ERROR_MESSAGES.REVIEW_PUBLISH_FAILED },
};

export function resolveDomainError(code, override = {}) {
  const meta = API_ERROR_CATALOG_DOMAIN[code] || { status: 500, title: 'Internal Server Error', message: 'Unexpected error' };
  return {
    status: Number(override.status ?? meta.status),
    title: String(override.title ?? meta.title),
    message: String(override.message ?? meta.message),
    code,
  };
}

export function toProblemDomain(code, detail, extensions = {}) {
  const { status, title, message } = resolveDomainError(code);
  return {
    type: 'about:blank',
    title,
    status,
    detail: String(detail || message),
    ...extensions,
  };
}
