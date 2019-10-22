#!/usr/bin/env node

import debug from 'debug';
import http from 'http';
import app from './app/app';
import mongoConnection from './app/util/mongoConnection';
import redisConnection from './app/util/redisConnection';

export const serverInfo = debug('vlibras-translator-api:info');
export const serverError = debug('vlibras-translator-api:error');

const normalizePort = function normalizeServerPort(portValue) {
  const port = parseInt(portValue, 10);

  if (Number.isNaN(port)) {
    return portValue;
  }

  if (port >= 0) {
    return port;
  }

  return false;
};

const serverPort = normalizePort(process.env.PORT || '3000');
app.set('port', serverPort);
const server = http.createServer(app);

const onError = function onErrorEvent(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof serverPort === 'string'
    ? `Pipe ${serverPort}`
    : `Port ${serverPort}`;

  switch (error.code) {
    case 'EACCES':
      serverError(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      serverError(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = function onListeningEvent() {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? `pipe ${addr}`
    : `port ${addr.port}`;
  serverInfo(`Listening on ${bind}`);
};

const listen = async function startListening() {
  try {
    await mongoConnection();
    serverInfo(`Connected to ${process.env.DB_NAME}`);
    await redisConnection();
    serverInfo(`Connected to ${process.env.CACHE_NAME}`);
    server.listen(serverPort);
    server.on('error', onError);
    server.on('listening', onListening);
  } catch (error) {
    serverError(error.message);
    process.exit(1);
  }
};

listen();
