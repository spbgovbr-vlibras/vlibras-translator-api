export const VALIDATION_VALUES = {
  textLength: { min: 1, max: 5000 },
  ratingOptions: ['good', 'bad'],
  avatarOptions: ['icaro', 'hozana'],
  captionOptions: ['on', 'off'],
  dateInterval: { min: 0, max: 8640000000000000 },
};

export const VALIDATION_ERRORS = {
  textLength: `'text' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  notFoundText: `'text' field is required.`,
  textType: '\'text\' must be a string.',
  domainEmpty: '\'domain\' must not be empty.',
  domainLength: `'domain' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  domainType: '\'domain\' must be a string.',
  glossLength: `'gloss' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  glossType: '\'gloss\' must be a string.',
  translationLength: `'translation' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  translationType: '\'translation\' must be a string.',
  reviewType: '\'review\' must be a string.',
  reviewLength: `'review' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  ratingOptions: `'rating' is not in valid values [${VALIDATION_VALUES.ratingOptions}].`,
  avatarOptions: `'avatar' is not in valid values [${VALIDATION_VALUES.avatarOptions}].`,
  captionOptions: `'caption' is not in valid values [${VALIDATION_VALUES.captionOptions}].`,
  uuidVersion: '\'requestUID\' must be a UUID version 4.',
  dateInterval: '\'timestamp\' is not in a valid date range.',
};
