import path from 'path';
import dotenv from 'dotenv';

const loadEnv = function loadEnviroment() {
  const environmentType = /^dev$|^production$/;

  if (environmentType.test(process.env.NODE_ENV)) {
    return path.join(__dirname, `.env.${process.env.NODE_ENV}`);
  }

  return path.join(__dirname, '.env.production');
};

const environment = dotenv.config({ path: loadEnv() }).parsed;

export default environment;
