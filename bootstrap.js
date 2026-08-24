#!/usr/bin/env node
/* eslint-disable no-console */

import { spawn } from 'node:child_process';
import createMigrationLock from './src/app/db/migrationLock.js';
import { MIGRATION_LOCK_BUSY } from './src/config/migration.js';

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(
      signal
        ? `${command} exited with signal ${signal}`
        : `${command} exited with code ${code}`,
    ));
  });
});

if (!process.env.NODE_ENV) {
  console.error('Environment variable NODE_ENV is required to start services');
  process.exit(1);
}

const lockEnabled = process.env.MIGRATION_LOCK_ENABLED !== 'false';
const migrationLock = createMigrationLock();
let migrationFailure = null;

try {
  if (lockEnabled) {
    console.log('Acquire Postgres migration lock');

    if (!await migrationLock.acquire()) {
      throw new Error(MIGRATION_LOCK_BUSY);
    }
  }

  console.log('Run Postgres migrations');
  await run(process.execPath, ['./node_modules/sequelize-cli/lib/sequelize', 'db:migrate']);
} catch (error) {
  migrationFailure = error;
}

try {
  await migrationLock.release();
} catch (error) {
  console.error(error.message);
}

if (migrationFailure) {
  console.error(migrationFailure.message);
  process.exit(1);
}

try {
  await import('./src/index.js');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
