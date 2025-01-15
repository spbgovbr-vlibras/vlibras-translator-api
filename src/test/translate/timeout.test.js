// timeout.test.js

import { CHANNEL_CLOSE_TIMEOUT, TRANSLATION_TIMEOUT, TRANSLATION_PAYLOAD_TTL } from '../../config/timeout'

describe('Timeout constants', () => {
  it('should have the correct value for CHANNEL_CLOSE_TIMEOUT', () => {
    expect(CHANNEL_CLOSE_TIMEOUT).toBe(500);
  });

  it('should have the correct value for TRANSLATION_TIMEOUT', () => {
    expect(TRANSLATION_TIMEOUT).toBe(30 * 1000); // 30 segundos
  });

  it('should have the correct value for TRANSLATION_PAYLOAD_TTL', () => {
    expect(TRANSLATION_PAYLOAD_TTL).toBe(30 * 1000); // 30 segundos
  });
});
