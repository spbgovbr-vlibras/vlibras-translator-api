require('dotenv').config(); // this is important!

module.exports = {
  "dev": {
    "username": process.env.DBSQL_USER,
    "password": process.env.DBSQL_PASS,
    "database": process.env.DBSQL_NAME,
    "host": process.env.DBSQL_HOST,
    "port": process.env.DBSQL_PORT,
    "dialect": "postgres"
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