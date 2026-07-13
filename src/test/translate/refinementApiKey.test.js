import {
  describe, expect, it, jest,
} from '@jest/globals';

import createApiKeyAuthMiddleware from '../../app/middlewares/apiKeyAuth.js';

const buildMiddleware = (envOverrides = {}) => createApiKeyAuthMiddleware({
  API_KEYS: 'shared-key',
  API_KEY_HEADER: 'x-api-key',
  ...envOverrides,
}, {
  enabled: true,
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

  it('should accept requests with the shared API key', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest({ 'x-api-key': 'shared-key' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should accept requests using ApiKey authorization header', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest({ authorization: 'ApiKey shared-key' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
