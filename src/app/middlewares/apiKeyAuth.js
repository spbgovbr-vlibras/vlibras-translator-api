import createError from 'http-errors';

const parseApiKeys = (rawValue = '') => rawValue
  .split(',')
  .map((apiKey) => apiKey.trim())
  .filter(Boolean);

const getApiKeyFromRequest = (req, headerName) => {
  const headerValue = req.get(headerName);

  if (headerValue) {
    return headerValue.trim();
  }

  const authorizationHeader = req.get('authorization');

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'ApiKey' || !token) {
    return null;
  }

  return token.trim();
};

const createApiKeyAuthMiddleware = (env) => {
  const isEnabled = env.API_KEY_AUTH_ENABLED === 'true';
  const headerName = env.API_KEY_HEADER || 'x-api-key';
  const allowedApiKeys = parseApiKeys(env.API_KEYS);

  return (req, _res, next) => {
    if (!isEnabled) {
      next();
      return;
    }

    if (allowedApiKeys.length === 0) {
      next(createError(500, 'API key authentication is enabled but no API keys are configured'));
      return;
    }

    const apiKey = getApiKeyFromRequest(req, headerName);

    if (!apiKey || !allowedApiKeys.includes(apiKey)) {
      next(createError(401, 'Unauthorized'));
      return;
    }

    next();
  };
};

export default createApiKeyAuthMiddleware;
