import createError from 'http-errors';
import { body, param, validationResult } from 'express-validator/check';
import { VALIDATION_VALUES, VALIDATION_ERROR } from '../../config/validation';

export const textValidationRules = body('text')
  .isLength(VALIDATION_VALUES.textLength)
  .withMessage(VALIDATION_ERROR.textLength);

export const idValidationRules = param('requestUID')
  .isUUID(4)
  .withMessage(VALIDATION_ERROR.uuidVersion);

export const reviewValidationRules = [
  body('text')
    .isLength(VALIDATION_VALUES.textLength)
    .withMessage(VALIDATION_ERROR.textLength),
  body('translation')
    .isLength(VALIDATION_VALUES.textLength)
    .withMessage(VALIDATION_ERROR.translationLength),
  body('rating')
    .matches(VALIDATION_VALUES.ratingOptions)
    .withMessage(VALIDATION_ERROR.ratingOptions),
];

export const videoValidationRules = [
  body('gloss')
    .isLength(VALIDATION_VALUES.textLength)
    .withMessage(VALIDATION_ERROR.glossLength),
  body('avatar')
    .matches(VALIDATION_VALUES.avatarOptions)
    .withMessage(VALIDATION_ERROR.avatarOptions),
  body('caption')
    .matches(VALIDATION_VALUES.captionOptions)
    .withMessage(VALIDATION_ERROR.captionOptions),
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
