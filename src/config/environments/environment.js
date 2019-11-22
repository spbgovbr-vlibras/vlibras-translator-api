import path from 'path';
import dotenv from 'dotenv';

const loadEnvironments = function loadEnviromentsVariables() {
  if (process.env.NODE_ENV === 'dev') {
    const dotEnvFile = path.join(__dirname, `.env.${process.env.NODE_ENV}`);
    return dotenv.config({ path: dotEnvFile }).parsed;
  }
  return process.env;
};

const env = loadEnvironments();

export default env;
