import mongoose from 'mongoose';
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false)

const uri = `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const db = function dbConnection() {
	return mongoose.connect(uri, { useNewUrlParser: true });
}

export default db;
