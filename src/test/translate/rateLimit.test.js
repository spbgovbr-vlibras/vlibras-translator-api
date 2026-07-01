import express from 'express';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';

import { createRateLimitMiddleware } from '../../app/middlewares/rateLimit.js';

const buildApp = (envOverrides = {}) => {
  const app = express();
  const {
    generalRateLimit,
    translateRateLimit,
  } = createRateLimitMiddleware({
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '2',
    TRANSLATE_RATE_LIMIT_WINDOW_MS: '60000',
    TRANSLATE_RATE_LIMIT_MAX_REQUESTS: '1',
    ...envOverrides,
  });

  app.set('trust proxy', true);
  app.use((req, res, next) => {
    if (req.path === '/translate') {
      next();
      return;
    }

    generalRateLimit(req, res, next);
  });
  app.use('/translate', translateRateLimit);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/translate', (_req, res) => {
    res.status(200).json({ translated: true });
  });

  return app;
};

describe('Rate limit middleware', () => {
  it('should expose rate limit headers and block after limit on general endpoints', async () => {
    const app = buildApp();

    const firstResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers['x-ratelimit-limit']).toBe('2');
    expect(firstResponse.headers['x-ratelimit-remaining']).toBe('1');
    expect(firstResponse.headers['x-ratelimit-reset']).toBeDefined();

    const secondResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers['x-ratelimit-remaining']).toBe('0');

    const blockedResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.10');

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.headers['retry-after']).toBe('60');
    expect(blockedResponse.body).toEqual({ error: 'Too Many Requests' });
  });

  it('should isolate buckets by authorization token on the same IP', async () => {
    const app = buildApp({
      RATE_LIMIT_MAX_REQUESTS: '1',
    });

    const firstTokenResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.20')
      .set('Authorization', 'Bearer token-a');

    expect(firstTokenResponse.status).toBe(200);

    const secondTokenResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.20')
      .set('Authorization', 'Bearer token-b');

    expect(secondTokenResponse.status).toBe(200);

    const blockedTokenResponse = await request(app)
      .get('/health')
      .set('X-Forwarded-For', '203.0.113.20')
      .set('Authorization', 'Bearer token-a');

    expect(blockedTokenResponse.status).toBe(429);
  });

  it('should apply the stricter translate limit independently', async () => {
    const app = buildApp();

    const firstResponse = await request(app)
      .post('/translate')
      .set('X-Forwarded-For', '203.0.113.30');

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers['x-ratelimit-limit']).toBe('1');
    expect(firstResponse.headers['x-ratelimit-remaining']).toBe('0');

    const blockedResponse = await request(app)
      .post('/translate')
      .set('X-Forwarded-For', '203.0.113.30');

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.headers['retry-after']).toBe('60');
  });
});
