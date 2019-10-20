import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

import environment from '../config/environments/environment';

import apiDocRoute from './doc/apiDocRoute';
import reviewRoute from './review/translationReviewRoute';
import translatorRoute from './translator/textTranslatorRoute';
import videoMakerRoute from './video/videoMakerRoute';

const app = express();

app.use(cors());
app.use(compression());
app.use(helmet());
app.use(logger(environment.LOGGER_FORMAT));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', apiDocRoute);
app.use('/', reviewRoute);
app.use('/', translatorRoute);
app.use('/', videoMakerRoute);

app.use((_req, _res, next) => {
  next(createError(404));
});

app.use((err, _req, res, _next) => {
  res.status(err.status || 500);
  if (app.get('env') === 'dev') {
    console.error('\x1b[2m', err);
    res.json({ error: err });
  } else {
    res.json({ error: err.message });
  }
});

export default app;
