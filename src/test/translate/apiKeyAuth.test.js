import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';

import createApiKeyAuthMiddleware from '../../app/middlewares/apiKeyAuth.js';

const buildApp = (envOverrides = {}) => {
  const app = express();
  const apiKeyAuth = createApiKeyAuthMiddleware({
    API_KEY_AUTH_ENABLED: 'true',
    API_KEY_HEADER: 'x-api-key',
    API_KEYS: 'key-a,key-b',
    ...envOverrides,
  });

  app.use(apiKeyAuth);
  app.get('/protected', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
};

describe('API key authentication middleware', () => {
  it('should allow requests when authentication is disabled', async () => {
    const app = express();
    app.use(createApiKeyAuthMiddleware({
      API_KEY_AUTH_ENABLED: 'false',
    }));
    app.get('/protected', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(200);
  });

  it('should reject requests without a valid API key', async () => {
    const app = buildApp();

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
  });

  it('should accept requests with the configured API key header', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/protected')
      .set('x-api-key', 'key-a');

    expect(response.status).toBe(200);
  });

  it('should accept requests with Authorization ApiKey', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'ApiKey key-b');

    expect(response.status).toBe(200);
  });

  it('should fail closed when enabled without configured keys', async () => {
    const app = buildApp({
      API_KEYS: '',
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(500);
  });
});
