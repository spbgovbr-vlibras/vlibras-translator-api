import rateLimit from 'express-rate-limit';

const parseInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
};

const getClientToken = (req) => {
  const authorizationHeader = req.get('authorization');

  if (!authorizationHeader) {
    return 'anonymous';
  }

  return authorizationHeader.trim();
};

const buildRateLimitKey = (req) => `${req.ip}:${getClientToken(req)}`;

const createRateLimitHandler = (windowMs) => (req, res) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  res.set('Retry-After', retryAfterSeconds.toString());
  res.status(429).json({
    error: 'Too Many Requests',
  });
};

const createLimiter = ({
  windowMs,
  maxRequests,
}) => rateLimit({
  windowMs,
  max: maxRequests,
  keyGenerator: buildRateLimitKey,
  standardHeaders: false,
  legacyHeaders: true,
  handler: createRateLimitHandler(windowMs),
});

const createRateLimitMiddleware = (env) => {
  const generalWindowMs = parseInteger(env.RATE_LIMIT_WINDOW_MS, 60_000);
  const generalMaxRequests = parseInteger(env.RATE_LIMIT_MAX_REQUESTS, 100);
  const translateWindowMs = parseInteger(env.TRANSLATE_RATE_LIMIT_WINDOW_MS, generalWindowMs);
  const translateMaxRequests = parseInteger(
    env.TRANSLATE_RATE_LIMIT_MAX_REQUESTS,
    Math.min(generalMaxRequests, 20),
  );

  return {
    generalRateLimit: createLimiter({
      windowMs: generalWindowMs,
      maxRequests: generalMaxRequests,
    }),
    translateRateLimit: createLimiter({
      windowMs: translateWindowMs,
      maxRequests: translateMaxRequests,
    }),
  };
};

export {
  buildRateLimitKey,
  createRateLimitMiddleware,
};
