import createError from 'http-errors';
import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';

import env from './config/environments/environment';
dotenv.config({ path: env() });

import healthRouter from './routes/healthCheck';
import reviewRouter from './routes/translationReview';
import translatorRouter from './routes/textTranslator';

const app = express();

app.use(cors());
app.use(logger(process.env.LOGGER_FORMAT));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', healthRouter);
app.use('/', reviewRouter);
app.use('/', translatorRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
	next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
	res.status(err.status || 500);
	if(app.get('env') === 'dev') {
		console.error('\x1b[2m', err);
		res.json({ error : err });
	} else {
		res.json({ error : err });
	}
});

export default app;
