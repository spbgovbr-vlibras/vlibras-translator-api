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

const resolveApiKeyConfig = (env, options = {}) => {
  const {
    apiKeysKey = 'API_KEYS',
    enabled = undefined,
    enabledKey = 'API_KEY_AUTH_ENABLED',
    fallbackApiKeysKey,
    fallbackHeaderNameKey,
    headerNameKey = 'API_KEY_HEADER',
  } = options;
  const resolvedEnabled = enabled ?? env[enabledKey] === 'true';
  const headerName = env[headerNameKey] || env[fallbackHeaderNameKey] || 'x-api-key';
  const configuredApiKeys = parseApiKeys(env[apiKeysKey]);
  const allowedApiKeys = configuredApiKeys.length > 0
    ? configuredApiKeys
    : parseApiKeys(env[fallbackApiKeysKey]);

  return {
    allowedApiKeys,
    headerName,
    isEnabled: resolvedEnabled,
  };
};

const createApiKeyAuthMiddleware = (env, options = {}) => {
  const {
    isEnabled,
    headerName,
    allowedApiKeys,
  } = resolveApiKeyConfig(env, options);

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
export { resolveApiKeyConfig };
