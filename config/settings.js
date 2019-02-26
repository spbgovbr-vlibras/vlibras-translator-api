/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

'use strict';

/**
 * Required libs.
 */
var path   = require('path');

var config = {};

config.contentsPath = process.env.VLIBRAS_VIDEO_LIBRAS;
config.bundlesPath = process.env.SIGNS_VLIBRAS;

config.platformsList = [ 'ANDROID', 'IOS', 'WEBGL', 'STANDALONE' ];

config.statesList = [ 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                      'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO' ];

module.exports = config;
