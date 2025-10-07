export const VALIDATION_VALUES = {
  textLength: { min: 1, max: 25000 },
  ratingOptions: ['good', 'bad'],
  avatarOptions: ['icaro', 'hozana'],
  captionOptions: ['on', 'off'],
  dateInterval: { min: 0, max: 8640000000000000 },
};

export const ERROR_CODES = {
  TEXT_REQUIRED: 'TEXT_REQUIRED',
  TEXT_TYPE: 'TEXT_TYPE',
  TEXT_LENGTH: 'TEXT_LENGTH',
  TRANSLATION_REQUIRED: 'TRANSLATION_REQUIRED',
  TRANSLATION_TYPE: 'TRANSLATION_TYPE',
  TRANSLATION_LENGTH: 'TRANSLATION_LENGTH',
  GLOSS_LENGTH: 'GLOSS_LENGTH',
  RATING_REQUIRED: 'RATING_REQUIRED',
  RATING_INVALID: 'RATING_INVALID',
  AVATAR_INVALID: 'AVATAR_INVALID',
  CAPTION_INVALID: 'CAPTION_INVALID',
  UUID_REQUIRED: 'UUID_REQUIRED',
  UUID_V4_INVALID: 'UUID_V4_INVALID',
  START_TIME_RANGE: 'START_TIME_RANGE',
  END_TIME_RANGE: 'END_TIME_RANGE',
  TIME_INTERVAL_INVALID: 'TIME_INTERVAL_INVALID',
  CONTENT_TYPE_INVALID: 'CONTENT_TYPE_INVALID',
  BODY_INVALID_JSON: 'BODY_INVALID_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
};

export const VALIDATION_ERRORS = {
  notFoundText: "'text' field is required.",
  textType: "'text' must be a string.",
  textLength: `'text' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  notFoundTranslation: "'translation' field is required.",
  translationType: "'translation' must be a string.",
  translationLength: `'translation' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  glossLength: `'gloss' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  ratingRequired: "'rating' is required.",
  ratingOptions: `'rating' is not in valid values [${VALIDATION_VALUES.ratingOptions}].`,
  avatarOptions: `'avatar' is not in valid values [${VALIDATION_VALUES.avatarOptions}].`,
  captionOptions: `'caption' is not in valid values [${VALIDATION_VALUES.captionOptions}].`,
  uuidRequired: "requestUID is required.",
  uuidVersion: "requestUID must be a valid UUID v4.",
  dateInterval: "'timestamp' is not in a valid date range.",
  timeIntervalInvalid: "startTime must be <= endTime",
  contentTypeInvalid: "Unsupported Content-Type. Expected application/json.",
  bodyInvalidJson: "Invalid JSON payload.",
};

export const API_ERROR_CATALOG = {
  TEXT_REQUIRED:        { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.notFoundText },
  TEXT_TYPE:            { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.textType },
  TRANSLATION_REQUIRED: { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.notFoundTranslation },
  TRANSLATION_TYPE:     { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.translationType },
  RATING_REQUIRED:      { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.ratingRequired },
  UUID_REQUIRED:        { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.uuidRequired },
  UUID_V4_INVALID:      { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.uuidVersion },
  START_TIME_RANGE:     { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.dateInterval },
  END_TIME_RANGE:       { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.dateInterval },
  TIME_INTERVAL_INVALID:{ status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.timeIntervalInvalid },
  CONTENT_TYPE_INVALID: { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.contentTypeInvalid },
  BODY_INVALID_JSON:    { status: 400, title: 'Invalid request', message: VALIDATION_ERRORS.bodyInvalidJson },
  TEXT_LENGTH:          { status: 422, title: 'Unprocessable entity', message: VALIDATION_ERRORS.textLength },
  TRANSLATION_LENGTH:   { status: 422, title: 'Unprocessable entity', message: VALIDATION_ERRORS.translationLength },
  GLOSS_LENGTH:         { status: 422, title: 'Unprocessable entity', message: VALIDATION_ERRORS.glossLength },
  RATING_INVALID:       { status: 422, title: 'Unprocessable entity', message: VALIDATION_ERRORS.ratingOptions },
  AVATAR_INVALID:       { status: 422, title: 'Unprocessable entity', message: VALIDATION_ERRORS.avatarOptions },
  CAPTION_INVALID:      { status: 422, title: 'Unprocessable entity', message: VALIDATION_ERRORS.captionOptions },
  VALIDATION_ERROR:     { status: 422, title: 'Validation failed', message: 'One or more fields are invalid.' },
};

export function toProblem({ type, title, status, detail, instance, extensions = {} }) {
  const base = {
    type: type || 'about:blank',
    title: title || 'Validation failed',
    status: Number(status || 422),
  };
  if (detail) base.detail = String(detail);
  if (instance) base.instance = String(instance);
  return { ...base, ...extensions };
}

export function toValidationProblem(errors, baseStatus) {
  const status = Number(baseStatus || (errors?.some((e) => Number(e.httpStatus) === 400) ? 400 : 422));
  const invalidParams = (errors || []).map((e) => ({
    name: e.field || 'unknown',
    reason: e.message || 'Invalid value',
    code: e.code || ERROR_CODES.VALIDATION_ERROR,
    location: e.location || 'body',
  }));
  return toProblem({
    status,
    title: status === 400 ? 'Invalid request' : 'Validation failed',
    detail: status === 400
      ? 'The request is syntactically correct but has invalid or missing fields.'
      : 'The request is semantically correct but violates business rules.',
    extensions: { 'invalid-params': invalidParams },
  });
}

export function resolveError(code, override = {}) {
  const meta = API_ERROR_CATALOG[code] || API_ERROR_CATALOG[ERROR_CODES.VALIDATION_ERROR];
  return {
    status: Number(override.status ?? meta.status),
    title: String(override.title ?? meta.title),
    message: String(override.message ?? meta.message),
    code,
  };
}
