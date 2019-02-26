/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

'use strict';

/**
 * Required libs.
 */
var path = require('path')
  , amqp = require('../helpers/amqpManager')
  , shortid = require('shortid')
  , settings = require('../config/settings')
  , error = require('../helpers/error');

exports.index=function(req, res, next) {
  var id = shortid.generate();
  var body = 'signal'; // Just to send something. It has no functionality.
  amqp.sendToQueue(body, id,'signals_t', false, res, function(err) {
    if (err)
      return error.internalError('An internal communication error has occurred.', next);
    amqp.receiveFromQueue(id, 'lists_t', false, res, function(err, message) {
      if (err)
        return error.internalError('An internal communication error has occurred.', next);
      res.status(200).send(message);
    });
  });
};

exports.show=function(req, res, next) {
  /**
   * Check the required params.
   */
  if (!req.params.sign || !req.params.platform)
    return error.badRequest('Sign and/or platform not specified.', next);
  /**
   * Check for supported platforms.
   */
  var upperPlatform = req.params.platform.toUpperCase();
  if (settings.platformsList.indexOf(upperPlatform) < 0)
    return error.notFound('Platform not recognized.', next);
  /**
   * Check for supported states.
   * If the state is suppressed, we use the national dictionary.
   */
  var upperState = req.params.state ? req.params.state.toUpperCase() : "";
  if ((upperState !== "") && (settings.statesList.indexOf(upperState) < 0))
    return error.notFound('State not recognized.', next);
  /**
   * Sends the bundle if it exists in the repository.
   */
  var upperSign = req.params.sign.toUpperCase();
  var bundle = path.join(settings.bundlesPath, upperPlatform, upperState, upperSign);
  res.sendFile(bundle, function(err) {
    if(err) { // Can't send from regional repository.
      bundle = path.join(settings.bundlesPath, upperPlatform, upperSign);
      res.sendFile(bundle); // Try to send from national repository.
    }
  });
};
