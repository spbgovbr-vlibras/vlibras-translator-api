import createError from 'http-errors';

const parseAllowedOrigins = (allowedOrigins = '') => allowedOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const createCorsOptions = ({ allowedOrigins = [], allowAllIfEmpty = false } = {}) => ({
  credentials: false,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowAllIfEmpty && allowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(createError(403, 'Origin not allowed by CORS'));
  },
});

export { parseAllowedOrigins, createCorsOptions };
