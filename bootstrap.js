#!/usr/bin/env node

import { spawn } from 'node:child_process';

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

try {
  console.log('Run Postgres migrations');
  await run(process.execPath, ['./node_modules/sequelize-cli/lib/sequelize', 'db:migrate']);
  await import('./src/index.js');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
