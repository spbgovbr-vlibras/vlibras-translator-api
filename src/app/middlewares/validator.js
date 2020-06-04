import createError from 'http-errors';
import {
  body, param, query, validationResult,
} from 'express-validator/check';
import { VALIDATION_VALUES, VALIDATION_ERRORS } from '../../config/validation';

export const textValidationRules = body('text')
  .isLength(VALIDATION_VALUES.textLength)
  .withMessage(VALIDATION_ERRORS.textLength);

export const idValidationRules = param('requestUID')
  .isUUID(4)
  .withMessage(VALIDATION_ERRORS.uuidVersion);

export const timestampValidationRules = [
  query('startTime')
    .optional()
    .isInt(VALIDATION_VALUES.dateInterval)
    .toInt()
    .withMessage(VALIDATION_ERRORS.dateInterval),
  query('endTime')
    .optional()
    .isInt(VALIDATION_VALUES.dateInterval)
    .toInt()
    .withMessage(VALIDATION_ERRORS.dateInterval),
];

export const reviewValidationRules = [
  body('text')
    .isLength(VALIDATION_VALUES.textLength)
    .withMessage(VALIDATION_ERRORS.textLength),
  body('translation')
    .isLength(VALIDATION_VALUES.textLength)
    .withMessage(VALIDATION_ERRORS.translationLength),
  body('rating')
    .isIn(VALIDATION_VALUES.ratingOptions)
    .withMessage(VALIDATION_ERRORS.ratingOptions),
];

export const videoValidationRules = [
  body('gloss')
    .isLength(VALIDATION_VALUES.textLength)
    .withMessage(VALIDATION_ERRORS.glossLength),
  body('avatar')
    .isIn(VALIDATION_VALUES.avatarOptions)
    .withMessage(VALIDATION_ERRORS.avatarOptions),
  body('caption')
    .isIn(VALIDATION_VALUES.captionOptions)
    .withMessage(VALIDATION_ERRORS.captionOptions),
];

export const checkValidation = function checkRequestValidation(req, _res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.param]: err.msg }));

  return next(createError(422, { errors: extractedErrors }));
};
