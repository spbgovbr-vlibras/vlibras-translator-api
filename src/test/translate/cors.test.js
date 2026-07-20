import { describe, expect, it } from '@jest/globals';

import { createCorsOptions, parseAllowedOrigins } from '../../app/middlewares/corsOptions.js';

describe('CORS helpers', () => {
  it('should parse comma-separated origins', () => {
    expect(parseAllowedOrigins('https://a.example, https://b.example')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('should allow any origin when allowed origins is empty and allowAllIfEmpty is true', () => {
    const options = createCorsOptions({
      allowedOrigins: parseAllowedOrigins(''),
      allowAllIfEmpty: true,
    });

    let callbackError;
    let callbackResult;

    options.origin('https://frontend.example', (error, allowed) => {
      callbackError = error;
      callbackResult = allowed;
    });

    expect(callbackError).toBeNull();
    expect(callbackResult).toBe(true);
  });

  it('should allow metrics origins when the allowlist is empty and allowAllIfEmpty is true', () => {
    const options = createCorsOptions({
      allowedOrigins: parseAllowedOrigins(''),
      allowAllIfEmpty: true,
    });

    let callbackError;
    let callbackResult;

    options.origin('https://grafana.example', (error, allowed) => {
      callbackError = error;
      callbackResult = allowed;
    });

    expect(callbackError).toBeNull();
    expect(callbackResult).toBe(true);
  });

  it('should reject origins not present in the allowlist when allowAllIfEmpty is false', () => {
    const options = createCorsOptions({
      allowedOrigins: parseAllowedOrigins('https://allowed.example'),
    });

    let callbackError;
    let callbackResult;

    options.origin('https://blocked.example', (error, allowed) => {
      callbackError = error;
      callbackResult = allowed;
    });

    expect(callbackError).toBeTruthy();
    expect(callbackError.status).toBe(403);
    expect(callbackResult).toBeUndefined();
  });
});
