import mongoose from 'mongoose';

mongoose.connection.on('error', (err) => {
  console.error(err);
});

const uri = `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const options = {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  keepAlive: true,
  keepAliveInitialDelay: 300000, // ms
  autoReconnect: true,
  reconnectInterval: 500, // ms
  reconnectTries: Number.MAX_VALUE, // Never stop
};

const mongoConnection = function mongoDBConnection() {
  return mongoose.connect(uri, options);
};

export default mongoConnection;
