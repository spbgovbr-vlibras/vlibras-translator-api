/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

'use strict';

/**
 * Required libs.
 */
var fs = require('fs')
  , path = require('path')
  , shortid = require('shortid')
  , Video = require('../models/video')
  , amqp = require('../helpers/amqpManager')
  , error = require('../helpers/error')
  , settings = require('../config/settings');

exports.create = function(req, res, next) {
  if (!req.body.gloss)
    return error.badRequest('The gloss key is missing.', next);

  var id = shortid.generate();
  var gloss = req.body.gloss;

  var video = new Video({
    status: 'processing'
  });

  new Promise(function (resolve) {
    video.save(function(err) {
      if (err)
        return error.internalError('A database error has occurred.', next);
      res.status(200).json({ id: video._id });
      resolve(gloss);
    });
  })
  .then(function(gloss) {
    return new Promise(function(resolve) {
      amqp.sendToQueue(gloss, id, 'glosses_t', false, res, function(err) {
        if (err)
          return error.internalError('An internal communication error has occurred.', next);
        amqp.receiveFromQueue(id, 'videos_t', false, res, function(err, message) {
          if (err)
            return error.internalError('An internal communication error has occurred.', next);
          resolve(message);
        });
      });
    })
    .then(function(message) {
      var body = JSON.parse(message);
      Video.findOneAndUpdate( {_id: video._id}, {
          $set:{
            file: body.file,
            size: body.size,
            status: body.status
          }
        }, {new: true}, function(err, content) {
          if (err)
            return error.internalError('A database error has occurred.', next);
        });
    });
  });
};

exports.download = function(req, res, next) {
  if (!req.params.file)
    return error.badRequest('File not specified.', next);

  var videoFile = path.join(settings.contentsPath, req.params.file);
  res.download(videoFile, function(err) {
    if (err)
      return error.notFound('Can\'t find any content.', next);

    fs.unlink(videoFile, function(err) {
      if (err)
        return console.error('Can\'t remove ' + videoFile);
      console.log(videoFile + ' removed.');
    });
  });
};

exports.status = function(req, res, next) {
  // Receive param id
  var contentID = req.params.id;
  // Find content by id on MongoDB
  return Video.findById(contentID, function (err, video) {
    // returns error when can not find content
    if (err)
      return error.notFound('Can\'t find any content.', next);
    else
      res.status(200).json({ 'status': video.status, 'file': video.file, 'size': video.size });
  });
};
