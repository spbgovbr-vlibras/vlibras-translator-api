// validation.test.js

import { VALIDATION_VALUES, VALIDATION_ERRORS } from '../../config/validation'; 

describe('Validation Constants', () => {
  it('should have correct textLength values', () => {
    expect(VALIDATION_VALUES.textLength.min).toBe(1);
    expect(VALIDATION_VALUES.textLength.max).toBe(5000);
  });

  it('should have correct ratingOptions values', () => {
    expect(VALIDATION_VALUES.ratingOptions).toEqual(['good', 'bad']);
  });

  it('should have correct avatarOptions values', () => {
    expect(VALIDATION_VALUES.avatarOptions).toEqual(['icaro', 'hozana']);
  });

  it('should have correct captionOptions values', () => {
    expect(VALIDATION_VALUES.captionOptions).toEqual(['on', 'off']);
  });

  it('should have correct dateInterval values', () => {
    expect(VALIDATION_VALUES.dateInterval.min).toBe(0);
    expect(VALIDATION_VALUES.dateInterval.max).toBe(8640000000000000);
  });
});

describe('Validation Error Messages', () => {
  it('should have correct error message for textLength', () => {
    expect(VALIDATION_ERRORS.textLength).toBe(
      `'text' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`
    );
  });

  it('should have correct error message for notFoundText', () => {
    expect(VALIDATION_ERRORS.notFoundText).toBe("'text' field is required.");
  });

  it('should have correct error message for glossLength', () => {
    expect(VALIDATION_ERRORS.glossLength).toBe(
      `'gloss' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`
    );
  });

  it('should have correct error message for translationLength', () => {
    expect(VALIDATION_ERRORS.translationLength).toBe(
      `'translation' exceeded ${VALIDATION_VALUES.textLength.max} characters limit.`
    );
  });

  it('should have correct error message for ratingOptions', () => {
    expect(VALIDATION_ERRORS.ratingOptions).toBe(
      `'rating' is not in valid values [${VALIDATION_VALUES.ratingOptions}].`
    );
  });

  it('should have correct error message for avatarOptions', () => {
    expect(VALIDATION_ERRORS.avatarOptions).toBe(
      `'avatar' is not in valid values [${VALIDATION_VALUES.avatarOptions}].`
    );
  });

  it('should have correct error message for captionOptions', () => {
    expect(VALIDATION_ERRORS.captionOptions).toBe(
      `'caption' is not in valid values [${VALIDATION_VALUES.captionOptions}].`
    );
  });

  it('should have correct error message for uuidVersion', () => {
    expect(VALIDATION_ERRORS.uuidVersion).toBe("'requestUID' must be a UUID version 4.");
  });

  it('should have correct error message for dateInterval', () => {
    expect(VALIDATION_ERRORS.dateInterval).toBe(
      "'timestamp' is not in a valid date range."
    );
  });
});
