import { readFileSync } from 'fs';
import pino from 'pino';

const packageJson = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'),
);

const nodeEnv = process.env.NODE_ENV || 'dev';
const defaultLevel = nodeEnv === 'test' ? 'silent' : 'info';

const logger = pino({
  level: process.env.LOG_LEVEL || defaultLevel,
  base: {
    service: 'vlibras-translator-api',
    version: packageJson.version,
    env: nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Cabeçalhos com credenciais nunca vão para o log.
  redact: [
    'req.headers.authorization',
    'req.headers["x-api-key"]',
    'req.headers.cookie',
  ],
  // pino-pretty é devDependency: só carregar com NODE_ENV=dev explícito.
  ...(process.env.NODE_ENV === 'dev' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});

export default logger;
