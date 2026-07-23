import { afterEach, describe, expect, it } from '@jest/globals';

import {
  getDetailedHealthAllowedIps,
  isDetailedHealthAllowed,
  parseAllowedIps,
} from '../../app/health/healthRoute.js';

const ORIGINAL_ENV = {
  INTERNAL_STATUS_ALLOWED_IPS: process.env.INTERNAL_STATUS_ALLOWED_IPS,
};

afterEach(() => {
  process.env.INTERNAL_STATUS_ALLOWED_IPS = ORIGINAL_ENV.INTERNAL_STATUS_ALLOWED_IPS;
});

describe('health route IP allowlist', () => {
  it('should parse comma-separated IPs', () => {
    expect(parseAllowedIps('127.0.0.1, 10.0.0.1')).toEqual([
      '127.0.0.1',
      '10.0.0.1',
    ]);
  });

  it('should allow any IP when INTERNAL_STATUS_ALLOWED_IPS is empty', () => {
    process.env.INTERNAL_STATUS_ALLOWED_IPS = '';

    expect(getDetailedHealthAllowedIps()).toBeNull();
    expect(isDetailedHealthAllowed('203.0.113.10')).toBe(true);
  });

  it('should restrict access to configured IPs when INTERNAL_STATUS_ALLOWED_IPS is set', () => {
    process.env.INTERNAL_STATUS_ALLOWED_IPS = '127.0.0.1,10.0.0.1';

    expect(getDetailedHealthAllowedIps()).toEqual(['127.0.0.1', '10.0.0.1']);
    expect(isDetailedHealthAllowed('127.0.0.1')).toBe(true);
    expect(isDetailedHealthAllowed('192.0.2.1')).toBe(false);
  });
});
