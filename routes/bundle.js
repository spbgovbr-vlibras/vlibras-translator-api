/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

var express = require('express')
  , router = express.Router()
  , bundleController = require('../controllers/bundle');

/**
 * Routes to get bundles of a specific platform.
 */
router
  .get('/signs', bundleController.index)
  .get('/:platform/:state?/:sign', bundleController.show)

module.exports = router;
