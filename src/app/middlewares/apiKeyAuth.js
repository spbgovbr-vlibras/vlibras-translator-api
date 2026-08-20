import createError from 'http-errors';

const parseApiKeys = (rawValue = '') => rawValue
  .split(',')
  .map((apiKey) => apiKey.trim())
  .filter(Boolean);

const parseBypassList = (rawValue = '') => rawValue
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const normalizeHost = (rawValue = '') => {
  const trimmedValue = rawValue.trim().toLowerCase();

  if (!trimmedValue) {
    return '';
  }

  if (trimmedValue.startsWith('[')) {
    const closingBracketIndex = trimmedValue.indexOf(']');

    if (closingBracketIndex !== -1) {
      return trimmedValue.slice(1, closingBracketIndex);
    }
  }

  const lastColonIndex = trimmedValue.lastIndexOf(':');
  const firstColonIndex = trimmedValue.indexOf(':');

  if (lastColonIndex > -1 && lastColonIndex === firstColonIndex) {
    return trimmedValue.slice(0, lastColonIndex);
  }

  return trimmedValue;
};

const getRequestHost = (req) => {
  if (typeof req.hostname === 'string' && req.hostname.trim()) {
    return normalizeHost(req.hostname);
  }

  const hostHeader = req.get('host');

  if (!hostHeader) {
    return '';
  }

  return normalizeHost(hostHeader);
};

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
    internalBypassEnabledKey = 'INTERNAL_AUTH_BYPASS_ENABLED',
    internalBypassHostsKey = 'INTERNAL_AUTH_BYPASS_HOSTS',
    internalBypassPathsKey = 'INTERNAL_AUTH_BYPASS_PATHS',
  } = options;
  const resolvedEnabled = enabled ?? env[enabledKey] === 'true';
  const headerName = env[headerNameKey] || env[fallbackHeaderNameKey] || 'x-api-key';
  const configuredApiKeys = parseApiKeys(env[apiKeysKey]);
  const allowedApiKeys = configuredApiKeys.length > 0
    ? configuredApiKeys
    : parseApiKeys(env[fallbackApiKeysKey]);
  const internalBypassHosts = parseBypassList(env[internalBypassHostsKey]);
  const internalBypassPaths = parseBypassList(env[internalBypassPathsKey]);

  return {
    allowedApiKeys,
    headerName,
    internalBypassHosts,
    internalBypassPaths,
    isInternalBypassEnabled: env[internalBypassEnabledKey] === 'true',
    isEnabled: resolvedEnabled,
  };
};

const createApiKeyAuthMiddleware = (env, options = {}) => {
  const {
    isEnabled,
    headerName,
    allowedApiKeys,
    isInternalBypassEnabled,
    internalBypassHosts,
    internalBypassPaths,
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

    if (
      isInternalBypassEnabled
      && internalBypassPaths.includes((req.path || '').toLowerCase())
      && internalBypassHosts.includes(getRequestHost(req))
    ) {
      next();
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
export {
  resolveApiKeyConfig,
  normalizeHost,
  getRequestHost,
};
