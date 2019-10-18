export const VALIDATION_VALUES = {
  textLength: { min: 1, max: 5000 },
  ratingOptions: /^good$|^bad$/,
  avatarOptions: /^icaro$|^hozana$/,
  captionOptions: /^enable$|^disable$/,
};

export const VALIDATION_ERROR = {
  textLength: `'text' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  glossLength: `'gloss' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  translationLength: `'translation' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`,
  ratingOptions: `'rating' should match to ${VALIDATION_VALUES.ratingOptions}.`,
  avatarOptions: `'avatar' should match to ${VALIDATION_VALUES.avatarOptions}.`,
  captionOptions: `'caption' should match to ${VALIDATION_VALUES.captionOptions}.`,
  uuidVersion: '\'requestUID\' must be a UUID version 4.',
};
