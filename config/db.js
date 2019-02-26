/**
 * Author: Wesnydy L. Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

/*
 * MongoDB Settings Connection
 */
'use strict';

/*
 * Required Libs.
 */
var mongoose = require('mongoose');

mongoose.Promise = require('bluebird');
var mongo = process.env.MONGO;
/*
 * Connection
 */
//mongoose.connect(mongodb://mongo/container_contents', function(err) {
mongoose.connect('mongodb://' + mongo + '/container_contents', function(err) {
  if(err) {
    console.log('MongoDB connection error: ', err);
  } else {
    console.log('MongoDB connection successful');
  };
});
