import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvironments = function loadEnviromentsVariables() {
  if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'test') {
    const dotEnvFile = path.join(__dirname, `.env.${process.env.NODE_ENV}`);
    dotenv.config({ path: dotEnvFile });
    return process.env; // Retorna process.env após carregar as variáveis de ambiente do arquivo
  }
  return process.env;
};

const env = loadEnvironments();

export default env;
