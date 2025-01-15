import createError from 'http-errors';
import {
  body, param, query, validationResult,
} from 'express-validator';
import { VALIDATION_VALUES, VALIDATION_ERRORS } from '../../config/validation.js';

export const textValidationRules = body('text')
  .exists()
  .withMessage(VALIDATION_ERRORS.notFoundText) // TODO: update express validator to 7.0 and add .bail()
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

export const checkValidation = function checkRequestValidation(req, _res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  // Log para verificar se os erros estão sendo gerados corretamente
  console.log("Validation errors:", errors.array());

  const extractedErrors = errors.array().map(err => {
    console.log("UIU", err);
    return {
      field: err.param || err.path || 'unknown',
      message: err.msg,
    };
  });

  // Garantir que os erros estão no formato correto ao serem passados para createError
  return next(createError(422, { errors: extractedErrors }));
};

