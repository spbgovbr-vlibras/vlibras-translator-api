import logger from './logger.js';

// Mantém a API antiga (baseada no pacote debug) para não alterar os pontos de chamada.
// Argumentos do tipo Error vão para o campo `err`; o restante compõe a mensagem.
const createLogFunction = (level, component) => (...args) => {
  const err = args.find((arg) => arg instanceof Error);
  const message = args
    .filter((arg) => !(arg instanceof Error) && arg !== '')
    .join(' ');

  logger[level]({ component, ...(err && { err }) }, message);
};

export const serverInfo = createLogFunction('info', 'api');
export const serverError = createLogFunction('error', 'api');
export const cacheError = createLogFunction('error', 'cache');
export const databaseError = createLogFunction('error', 'db');
