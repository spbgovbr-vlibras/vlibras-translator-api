// errorMessages.test.js

import { TRANSLATOR_ERROR, METRICS_ERROR, REVIEW_ERROR } from '../../config/error';

describe('Error Messages', () => {
  describe('TRANSLATOR_ERROR', () => {
    it('should have correct unavailable error message', () => {
      expect(TRANSLATOR_ERROR.unavailable).toBe('Translation Core Unavailable');
    });

    it('should have correct wrongResponse error message', () => {
      expect(TRANSLATOR_ERROR.wrongResponse).toBe('Translation Core response message has invalid properties');
    });

    it('should have correct timeout error message', () => {
      expect(TRANSLATOR_ERROR.timeout).toBe('Translation Core Timeout');
    });

    it('should have correct translationError error message', () => {
      expect(TRANSLATOR_ERROR.translationError).toBe('Problem during translation process');
    });
  });

  describe('METRICS_ERROR', () => {
    it('should have correct metricsError message', () => {
      expect(METRICS_ERROR.metricsError).toBe('Failed to access metrics');
    });
  });

  describe('REVIEW_ERROR', () => {
    it('should have correct reviewError message', () => {
      expect(REVIEW_ERROR.reviewError).toBe('Failed to publish review.');
    });
  });
});
