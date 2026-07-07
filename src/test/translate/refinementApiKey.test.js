import {
  describe, expect, it, jest,
} from '@jest/globals';

import createApiKeyAuthMiddleware from '../../app/middlewares/apiKeyAuth.js';

const buildMiddleware = (envOverrides = {}) => createApiKeyAuthMiddleware({
  API_KEYS: 'fallback-key',
  API_KEY_HEADER: 'x-api-key',
  ...envOverrides,
}, {
  apiKeysKey: 'GLOSS_REFINEMENT_API_KEYS',
  enabled: true,
  fallbackApiKeysKey: 'API_KEYS',
  fallbackHeaderNameKey: 'API_KEY_HEADER',
  headerNameKey: 'GLOSS_REFINEMENT_API_KEY_HEADER',
});
const createRequest = (headers = {}) => ({
  get: (headerName) => headers[headerName.toLowerCase()] || headers[headerName] || undefined,
});

describe('Refinement API key middleware', () => {
  it('should reject requests without an API key', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest(), {}, next);

    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('should accept requests with a route-specific API key', async () => {
    const middleware = buildMiddleware({
      GLOSS_REFINEMENT_API_KEYS: 'refine-key',
    });
    const next = jest.fn();

    middleware(createRequest({ 'x-api-key': 'refine-key' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should fall back to the shared API key configuration', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest({ 'x-api-key': 'fallback-key' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
