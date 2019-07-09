import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

import env from './config/environments/environment';

import apiDocRouter from './routes/apiDoc';
import healthRouter from './routes/healthCheck';
import reviewRouter from './routes/translationReview';
import translatorRouter from './routes/textTranslator';
import videoMakerRouter from './routes/videoMaker';

const app = express();

app.use(cors());
app.use(compression());
app.use(helmet());
app.use(logger(env.LOGGER_FORMAT));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', apiDocRouter);
app.use('/', healthRouter);
app.use('/', reviewRouter);
app.use('/', translatorRouter);
app.use('/', videoMakerRouter);

app.use((req, res, next) => {
	next(createError(404));
});

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
