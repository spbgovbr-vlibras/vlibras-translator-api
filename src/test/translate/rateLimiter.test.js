import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app/app.js';

describe('Rate Limiter Tests', () => {
  // Helper to create delay between requests
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  describe('Translation Rate Limiter', () => {
    it('should allow requests under the limit', async () => {
      // Make 3 requests (well under the 20/minute limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/translate')
          .send({ text: 'Hello world' });

        // Should not be rate limited
        expect(response.status).not.toBe(429);
      }
    });

    it('should return 429 when translation rate limit is exceeded', async () => {
      // Translation limiter: 20 requests per minute
      const requests = [];

      // Make 21 rapid requests to exceed the limit
      for (let i = 0; i < 21; i++) {
        requests.push(
          request(app)
            .post('/translate')
            .send({ text: `Test message ${i}` })
        );
      }

      const responses = await Promise.all(requests);

      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check that rate limited response has correct message
      const rateLimited = rateLimitedResponses[0];
      expect(rateLimited.body.error).toContain('Translation rate limit exceeded');
    }, 30000); // Increase timeout for this test
  });

  describe('Review Rate Limiter', () => {
    it('should allow requests under the limit', async () => {
      // Make 3 requests (well under the 10/5min limit)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/review')
          .send({
            text: 'HELLO WORLD',
            translation: 'OLA MUNDO',
            rating: 'good',
            review: 'GREAT TRANSLATION'
          });

        // Should not be rate limited (may fail validation, but not rate limit)
        expect(response.status).not.toBe(429);
      }
    });

    it('should return 429 when review rate limit is exceeded', async () => {
      // Review limiter: 10 requests per 5 minutes
      const requests = [];

      // Make 11 rapid requests to exceed the limit
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post('/review')
            .send({
              text: 'HELLO',
              translation: `TRANSLATION${i}`,
              rating: 'good',
              review: `REVIEW${i}`
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check that rate limited response has correct message
      const rateLimited = rateLimitedResponses[0];
      expect(rateLimited.body.error).toContain('Review rate limit exceeded');
    }, 30000); // Increase timeout for this test
  });

  describe('Health Check Rate Limiter', () => {
    it('should allow requests under the limit', async () => {
      // Make 5 requests (well under the 60/minute limit)
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/health');

        // Should not be rate limited
        expect(response.status).not.toBe(429);
      }
    });

    it('should return 429 when health check rate limit is exceeded', async () => {
      // Health limiter: 60 requests per minute
      const requests = [];

      // Make 65 rapid requests to exceed the limit
      for (let i = 0; i < 65; i++) {
        requests.push(request(app).get('/health'));
      }

      const responses = await Promise.all(requests);

      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check that rate limited response has correct message
      const rateLimited = rateLimitedResponses[0];
      expect(rateLimited.body.error).toContain('Health check rate limit exceeded');
    }, 30000); // Increase timeout for this test
  });

  describe('General Rate Limiter', () => {
    it('should include RateLimit headers in response', async () => {
      const response = await request(app)
        .post('/translate')
        .send({ text: 'Test' });

      // Should have rate limit headers
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });

    it('should track rate limits per IP', async () => {
      // Make a request
      const response1 = await request(app)
        .post('/translate')
        .send({ text: 'Test 1' });

      const remaining1 = parseInt(response1.headers['ratelimit-remaining']);

      // Make another request from same IP
      const response2 = await request(app)
        .post('/translate')
        .send({ text: 'Test 2' });

      const remaining2 = parseInt(response2.headers['ratelimit-remaining']);

      // Remaining count should decrease
      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('Healthcheck endpoint (no specific rate limiter)', () => {
    it('should be accessible without rate limiting issues', async () => {
      const response = await request(app).get('/healthcheck');

      // Should return 200
      expect(response.status).toBe(200);
    });
  });
});
