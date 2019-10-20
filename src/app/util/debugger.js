import debug from 'debug';

export const serverInfo = debug('vlibras-translator-api:info');
export const serverError = debug('vlibras-translator-api:error');
export const cacheError = debug('vlibras-translator-cache:error');
export const databaseError = debug('vlibras-translator-db:error');
