import env from '../../../config/environments/environment.js';

export default {
  dev: {
    username: env.DBSQL_USER,
    password: env.DBSQL_PASS,
    database: env.DBSQL_NAME,
    host: env.DBSQL_HOST,
    port: env.DBSQL_PORT,
    dialect: 'postgres'
  },
  test: {
    username: process.env.DBSQL_USER,
    password: process.env.DBSQL_PASS,
    database: process.env.DBSQL_NAME,
    host: process.env.DBSQL_HOST,
    port: process.env.DBSQL_PORT,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DBSQL_USER,
    password: process.env.DBSQL_PASS,
    database: process.env.DBSQL_NAME,
    host: process.env.DBSQL_HOST,
    port: process.env.DBSQL_PORT,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Importante para conexão com RDS da AWS
      }
    },
    logging: false,
  },
};
