const env = require('../../../config/environments/environment').default;

module.exports = {
  "dev": {
    "username": env.DBSQL_USER,
    "password": env.DBSQL_PASS,
    "database": env.DBSQL_NAME,
    "host": env.DBSQL_HOST,
    "port": env.DBSQL_PORT,
    dialect: "postgres"
  },
  "test": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASS,
    "database": process.env.DB_NAME,
    "host": process.env.DB_HOST,
    "port": process.env.DB_PORT,
    "dialect": "postgres"
  },
  "production": {
    "username": process.env.DB_USER,
    "password": process.env.DB_PASS,
    "database": process.env.DB_NAME,
    "host": process.env.DB_HOST,
    "port": process.env.DB_PORT,
    "dialect": "postgres"
  }
};
