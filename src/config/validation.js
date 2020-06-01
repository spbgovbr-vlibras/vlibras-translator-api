export const VALIDATION_VALUES = {
  textLength: { min: 1, max: 5000 },
  ratingOptions: ['good', 'bad'],
  avatarOptions: ['icaro', 'hozana'],
  captionOptions: ['on', 'off'],
  dateInterval: { min: 0, max: 8640000000000000 },
};

export const VALIDATION_ERRORS = {
  textLength: `'text' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  glossLength: `'gloss' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  translationLength: `'translation' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  ratingOptions: `'rating' is not in valid values [${VALIDATION_VALUES.ratingOptions}].`,
  avatarOptions: `'avatar' is not in valid values [${VALIDATION_VALUES.avatarOptions}].`,
  captionOptions: `'caption' is not in valid values [${VALIDATION_VALUES.captionOptions}].`,
  uuidVersion: '\'requestUID\' must be a UUID version 4.',
  dateInterval: '\'timestamp\' is not in a valid date range.',
};
