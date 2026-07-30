import createError from 'http-errors';
import { z } from 'zod';
import { VALIDATION_VALUES, VALIDATION_ERRORS } from '../../config/validation.js';

const buildErrorPayload = (issues) => ({
  errors: issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  })),
});
const createTimestampFieldSchema = () => z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (Number.isNaN(parsedValue)) {
      return null;
    }

    return parsedValue;
  },
  z.number({
    invalid_type_error: VALIDATION_ERRORS.dateInterval,
    required_error: VALIDATION_ERRORS.dateInterval,
  })
    .int(VALIDATION_ERRORS.dateInterval)
    .min(VALIDATION_VALUES.dateInterval.min, VALIDATION_ERRORS.dateInterval)
    .max(VALIDATION_VALUES.dateInterval.max, VALIDATION_ERRORS.dateInterval)
    .optional(),
);
const createValidationError = (statusCode, issues) => {
  const errorPayload = buildErrorPayload(issues);
  const error = createError(statusCode);

  error.errors = errorPayload.errors;

  return error;
};

const validateWithSchema = ({
  schema,
  source,
  statusCode = 422,
}) => (req, _res, next) => {
  const validationResult = schema.safeParse(req[source]);

  if (validationResult.success) {
    req[source] = validationResult.data;
    next();
    return;
  }

  next(createValidationError(statusCode, validationResult.error.issues));
};

const textSchema = z.object({
  text: z.string({
    invalid_type_error: VALIDATION_ERRORS.textType,
    required_error: VALIDATION_ERRORS.notFoundText,
  })
    .min(VALIDATION_VALUES.textLength.min, VALIDATION_ERRORS.notFoundText)
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.textLength),
  domain: z.string({
    invalid_type_error: VALIDATION_ERRORS.domainType,
  })
    .min(VALIDATION_VALUES.textLength.min, VALIDATION_ERRORS.domainEmpty)
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.domainLength)
    .optional(),
}).strict();

const refineSchema = z.object({
  text: z.string({
    invalid_type_error: VALIDATION_ERRORS.textType,
    required_error: VALIDATION_ERRORS.notFoundText,
  })
    .min(VALIDATION_VALUES.textLength.min, VALIDATION_ERRORS.notFoundText)
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.textLength),
  gloss: z.string({
    invalid_type_error: VALIDATION_ERRORS.glossType,
  })
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.glossLength)
    .optional(),
}).strict();

const uuidSchema = z.object({
  requestUID: z.string()
    .uuid(VALIDATION_ERRORS.uuidVersion),
}).strict();

const timestampSchema = z.object({
  startTime: createTimestampFieldSchema(),
  endTime: createTimestampFieldSchema(),
}).strict();

const reviewSchema = z.object({
  text: z.string({
    invalid_type_error: VALIDATION_ERRORS.textType,
    required_error: VALIDATION_ERRORS.notFoundText,
  })
    .min(VALIDATION_VALUES.textLength.min, VALIDATION_ERRORS.notFoundText)
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.textLength),
  translation: z.string({
    invalid_type_error: VALIDATION_ERRORS.translationType,
    required_error: VALIDATION_ERRORS.translationLength,
  })
    .min(VALIDATION_VALUES.textLength.min, VALIDATION_ERRORS.translationLength)
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.translationLength),
  rating: z.enum(VALIDATION_VALUES.ratingOptions, {
    errorMap: () => ({ message: VALIDATION_ERRORS.ratingOptions }),
  }),
  review: z.string({
    invalid_type_error: VALIDATION_ERRORS.reviewType,
  })
    .max(VALIDATION_VALUES.textLength.max, VALIDATION_ERRORS.reviewLength)
    .optional(),
}).strict();

const textValidationRules = validateWithSchema({
  schema: textSchema,
  source: 'body',
});

const idValidationRules = validateWithSchema({
  schema: uuidSchema,
  source: 'params',
});

const timestampValidationRules = validateWithSchema({
  schema: timestampSchema,
  source: 'query',
});

const reviewValidationRules = validateWithSchema({
  schema: reviewSchema,
  source: 'body',
  statusCode: 400,
});

const refineValidationRules = validateWithSchema({
  schema: refineSchema,
  source: 'body',
});

const checkValidation = (_req, _res, next) => {
  next();
};

export {
  textValidationRules,
  refineValidationRules,
  idValidationRules,
  timestampValidationRules,
  reviewValidationRules,
  checkValidation,
};
