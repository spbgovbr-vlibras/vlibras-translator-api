import mongoose from 'mongoose';

mongoose.connection.on('error', (err) => {
  console.error('\x1b[2m', err);
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
    },
  );
};

export default mongoConnection;
