/**
 * Author: Jonathan Lincoln Brilhante
 * Email: jonathan.lincoln.brilhante@gmail.com
 *
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

'use strict';

/**
 * Module dependencies.
 */
var express = require('express');
var bodyParser = require('body-parser');

var db = require('./config/db');
// var settings = require('./config/settings');

var bundle = require('./routes/bundle');
var translate = require('./routes/translate');
var video = require('./routes/video');

var app = express();

/**
 * For parsing application/json and application/x-www-form-urlencoded
 */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Public directory.
 */
// app.use('/video', express.static(settings.contentsPath));

/**
 * Allow cross origin requests.
 */
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Methods", "POST, GET");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/**
 * Register routes.
 */
app.use('/video', video);
app.use('/translate', translate);
app.use('/', bundle);

/**
 * Error handler.
 */
app.use(function(err, req, res, next) {
  if (app.get('env') !== 'development')
    delete err.stack
  res.status(err.status).json({
    'error': {
      'message': err.message,
      'status': err.status,
      'stack': err.stack
    }
  });
});

module.exports = app;
