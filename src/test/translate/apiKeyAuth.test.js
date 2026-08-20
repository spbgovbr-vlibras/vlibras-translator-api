import { describe, expect, it, jest } from '@jest/globals';

import createApiKeyAuthMiddleware from '../../app/middlewares/apiKeyAuth.js';

const buildMiddleware = (envOverrides = {}) => createApiKeyAuthMiddleware({
  API_KEY_AUTH_ENABLED: 'true',
  API_KEY_HEADER: 'x-api-key',
  API_KEYS: 'key-a,key-b',
  ...envOverrides,
});

const createRequest = ({
  headers = {},
  hostname,
  path = '/protected',
} = {}) => ({
  path,
  hostname,
  get: (headerName) => headers[headerName.toLowerCase()] || headers[headerName] || undefined,
});

describe('API key authentication middleware', () => {
  it('should allow requests when authentication is disabled', async () => {
    const middleware = createApiKeyAuthMiddleware({
      API_KEY_AUTH_ENABLED: 'false',
    });
    const next = jest.fn();

    middleware(createRequest(), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject requests without a valid API key', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest(), {}, next);

    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('should accept requests with the configured API key header', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest({ headers: { 'x-api-key': 'key-a' } }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should accept requests with Authorization ApiKey', async () => {
    const middleware = buildMiddleware();
    const next = jest.fn();

    middleware(createRequest({ headers: { authorization: 'ApiKey key-b' } }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should fail closed when enabled without configured keys', async () => {
    const middleware = buildMiddleware({
      API_KEYS: '',
    });
    const next = jest.fn();

    middleware(createRequest(), {}, next);

    expect(next.mock.calls[0][0].status).toBe(500);
  });

  it('should allow bypass for configured internal hosts on operational paths', async () => {
    const middleware = buildMiddleware({
      INTERNAL_AUTH_BYPASS_ENABLED: 'true',
      INTERNAL_AUTH_BYPASS_PATHS: '/metrics,/status,/healthcheck',
      INTERNAL_AUTH_BYPASS_HOSTS: 'tradapi-prd-tradapi.vlibras.svc.cluster.local,localhost,127.0.0.1,::1',
    });
    const next = jest.fn();

    middleware(createRequest({
      headers: { host: 'tradapi-prd-tradapi.vlibras.svc.cluster.local' },
      path: '/metrics',
    }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should allow bypass for localhost hosts with ports', async () => {
    const middleware = buildMiddleware({
      INTERNAL_AUTH_BYPASS_ENABLED: 'true',
      INTERNAL_AUTH_BYPASS_PATHS: '/metrics,/status,/healthcheck',
      INTERNAL_AUTH_BYPASS_HOSTS: 'localhost,127.0.0.1,::1',
    });
    const next = jest.fn();

    middleware(createRequest({
      headers: { host: 'localhost:3000' },
      path: '/healthcheck',
    }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject requests without API key when host is not allowlisted for bypass', async () => {
    const middleware = buildMiddleware({
      INTERNAL_AUTH_BYPASS_ENABLED: 'true',
      INTERNAL_AUTH_BYPASS_PATHS: '/metrics,/status,/healthcheck',
      INTERNAL_AUTH_BYPASS_HOSTS: 'tradapi-prd-tradapi.vlibras.svc.cluster.local,localhost',
    });
    const next = jest.fn();

    middleware(createRequest({
      headers: { host: 'external.example.com' },
      path: '/metrics',
    }), {}, next);

    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('should reject bypass on routes outside the configured operational allowlist', async () => {
    const middleware = buildMiddleware({
      INTERNAL_AUTH_BYPASS_ENABLED: 'true',
      INTERNAL_AUTH_BYPASS_PATHS: '/metrics,/status,/healthcheck',
      INTERNAL_AUTH_BYPASS_HOSTS: 'tradapi-prd-tradapi.vlibras.svc.cluster.local,localhost',
    });
    const next = jest.fn();

    middleware(createRequest({
      headers: { host: 'tradapi-prd-tradapi.vlibras.svc.cluster.local' },
      path: '/protected',
    }), {}, next);

    expect(next.mock.calls[0][0].status).toBe(401);
  });
});
