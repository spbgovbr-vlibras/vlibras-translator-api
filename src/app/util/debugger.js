import debug from 'debug';

//export const serverInfo = debug('vlibras-translator-api:info');
//export const serverError = debug('vlibras-translator-api:error');
//export const cacheError = debug('vlibras-translator-cache:error');
//export const databaseError = debug('vlibras-translator-db:error');


export const serverInfo = (msg, ...rest) => {
    console.log(`vlibras-translator-api:info ${msg}`, ...rest);
};

export const serverError = (msg, ...rest) => {
    console.log(`vlibras-translator-api:error ${msg}`, ...rest);
};

export const cacheError = (msg, ...rest) => {
    console.log(`vlibras-translator-cache:error ${msg}`, ...rest);
};

export const databaseError = (msg, ...rest) => {
    console.log(`vlibras-translator-db:error ${msg}`, ...rest);
};
