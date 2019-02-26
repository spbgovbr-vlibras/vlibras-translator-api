/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

'use strict';

/**
 * Required libs.
 */
var shortid = require('shortid')
  , amqp = require('../helpers/amqpManager')
  , error = require('../helpers/error');

exports.translate = function(req, res, next) {
  if (!req.body.text)
    return error.badRequest('The text key is missing.', next);

  var id = shortid.generate();
  var text = req.body.text;

  amqp.sendToQueue(text, id,'texts_t', false, res, function(err) {
    if (err)
      return error.internalError('An internal communication error has occurred.', next);
    amqp.receiveFromQueue(id, 'translations_t', false, res, function(err, message) {
      if (err)
        return error.internalError('An internal communication error has occurred.', next);
      res.status(200).send(message);
    });
  });
};

// TEMPORARY
exports.translateURL = function(req, res, next) {
  if (!req.param('text'))
    return error.badRequest('The text param is missing.', next);

  var id = shortid.generate();
  var text = req.param('text').toString('utf8');

  amqp.sendToQueue(text, id,'texts_t', false, res, function(err) {
    if (err)
      return error.internalError('An internal communication error has occurred.', next);
    amqp.receiveFromQueue(id, 'translations_t', false, res, function(err, message) {
      if (err)
        return error.internalError('An internal communication error has occurred.', next);
      res.status(200).send(message);
    });
  });
};
