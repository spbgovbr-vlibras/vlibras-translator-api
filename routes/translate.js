/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

var express = require('express')
  , router = express.Router()
  , translateController = require('../controllers/translate');

/**
 * Routes to process text and return gloss.
 */
router
  .post('/', translateController.translate)
  .get('/', translateController.translateURL) // TEMPORARY

module.exports = router;
