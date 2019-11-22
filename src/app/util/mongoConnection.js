import mongoose from 'mongoose';
import { databaseError } from './debugger';

mongoose.connection.on('error', (err) => {
  databaseError(err);
});

mongoose.connection.on('disconnected', (err) => {
  databaseError(err);
});

const mongoConnection = function mongoDBConnection() {
  return mongoose.connect(
    `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
      keepAlive: true,
      keepAliveInitialDelay: 300000, // 5m in ms
      autoReconnect: true,
      reconnectInterval: 500, // ms
      reconnectTries: Number.MAX_VALUE, // Never stop
      ...(process.env.DB_USER && { user: process.env.DB_USER }),
      ...(process.env.DB_PASS && { pass: process.env.DB_PASS }),
    },
  );
};

export default mongoConnection;
