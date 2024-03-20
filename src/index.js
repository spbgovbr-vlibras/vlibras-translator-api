#!/usr/bin/env node

import http from 'http';
import app from './app/app.js';
import db from './app/db/models/index.js';
import redisConnection from './app/util/redisConnection.js';
import { serverInfo, serverError, cacheError, databaseError } from './app/util/debugger.js';

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

const onError = function onErrorEvent(error, port) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? `Pipe ${port}`
    : `Port ${port}`;

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

const onListening = function onListeningEvent(addr) {
  const bind = typeof addr === 'string'
    ? `pipe ${addr}`
    : `port ${addr.port}`;
  serverInfo(`Listening on ${bind}`);
};

const startHTTPServer = async function startHTTPServerListen() {
  try {
    serverInfo('Starting server');

    try {
      await db.sequelize.authenticate();
      serverInfo(`Connected to database ${process.env.DBSQL_NAME}`);
    } catch (error) {
      databaseError('Failed connecting to database')
    }
    
    try {
      await redisConnection();
      serverInfo(`Connected to ${process.env.CACHE_NAME}`);
    } catch (error) {
      cacheError('Fail connecting to cache server')
    }

    const server = http.createServer(app);
    server.listen(app.get('port'));
    server.on('error', (err) => { onError(err, app.get('port')); });
    server.on('listening', () => { onListening(server.address()); });
  } catch (error) {
    serverError('', error.stack);
    process.exit(1);
  }
};

app.set('port', normalizePort(process.env.PORT || '3000'));
startHTTPServer();
