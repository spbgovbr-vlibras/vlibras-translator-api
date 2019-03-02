import createError from 'http-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';

import translatorRouter from './routes/textTranslator';

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', translatorRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  if(app.get('env') === 'development') {
    console.error('\x1b[2m', err);
    res.json({ error : err });
  } else {
    res.json({ error : err });
  }
});

export default app;
