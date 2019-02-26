/**
 * Author: Wesnydy Lima Ribeiro
 * Email: wesnydy@lavid.ufpb.br
 */

/*
 * Video Model
 */

'use strict';

/**
 * Required libs.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/**
 * Model Schema
 */
var videoSchema = new Schema({
  file: { type: String, required: false },
  size: { type: Number, required: false },
  duration: { type: Number, required: false },
  status: { type: String, required: true }
}, { timestamps: { createdAt: 'created_at' }, versionKey: false });

module.exports = mongoose.model('Video', videoSchema);
