import pg from 'pg';
import config from './config/config.js';

const buildClientConfig = function buildPostgresClientConfig(sequelizeConfig) {
  const { dialectOptions = {} } = sequelizeConfig;

  if (sequelizeConfig.use_env_variable) {
    return {
      connectionString: process.env[sequelizeConfig.use_env_variable],
      ...dialectOptions,
    };
  }

  return {
    user: sequelizeConfig.username,
    password: sequelizeConfig.password,
    database: sequelizeConfig.database,
    host: sequelizeConfig.host,
    port: sequelizeConfig.port,
    ...dialectOptions,
  };
};

const createPostgresClient = function createStandalonePostgresClient() {
  const env = process.env.NODE_ENV || 'dev';

  return new pg.Client(buildClientConfig(config[env]));
};

export default createPostgresClient;
export {
  buildClientConfig,
};
