import rateLimit from 'express-rate-limit';
import { serverInfo } from '../util/debugger.js';

/**
 * General rate limiter for API routes
 * Limits: 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    serverInfo(`[RateLimiter] General limit exceeded for IP: ${ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.'
    });
  },
});

/**
 * Strict rate limiter for translation endpoint
 * Limits: 60 translations per 1 minute per IP
 * Translation requests are resource-intensive (RabbitMQ, database, cache)
 */
export const translationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 20 translation requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Translation rate limit exceeded. Please wait before making more translation requests.',
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    serverInfo(`[RateLimiter] Translation limit exceeded for IP: ${ip}`);
    res.status(429).json({
      error: 'Translation rate limit exceeded. Please wait before making more translation requests.'
    });
  },
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false, // Count failed requests too
});

/**
 * Moderate rate limiter for review endpoint
 * Limits: 10 reviews per 5 minutes per IP
 * Reviews need moderation to prevent spam
 */
export const reviewLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // Limit each IP to 10 reviews per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Review rate limit exceeded. Please wait before submitting more reviews.',
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    serverInfo(`[RateLimiter] Review limit exceeded for IP: ${ip}`);
    res.status(429).json({
      error: 'Review rate limit exceeded. Please wait before submitting more reviews.'
    });
  },
});

/**
 * Lenient rate limiter for health/metrics endpoints
 * Limits: 60 requests per 1 minute per IP
 */
export const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Health check rate limit exceeded.',
  handler: (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    serverInfo(`[RateLimiter] Health check limit exceeded for IP: ${ip}`);
    res.status(429).json({
      error: 'Health check rate limit exceeded.'
    });
  },
});
