import { Schema, model } from 'mongoose';

import { VIDEO_STATUS, VIDEO_EXPIRATION_TIME } from '../../config/status';

const options = {
  timestamps: true,
  versionKey: false,
};

const videoSchema = new Schema({
  gloss: {
    type: String,
    required: true,
  },

  uid: {
    type: String,
    unique: true,
    required: true,
  },

  path: String,

  size: Number,

  duration: Number,

  status: {
    type: String,
    enum: Object.values(VIDEO_STATUS),
    required: true,
  },

  requester: {
    type: String,
    required: true,
  },
}, options);

videoSchema.virtual('expired').get(function isExpired() {
  const time = Math.abs(Date.now() - this.updatedAt);
  return time > VIDEO_EXPIRATION_TIME;
});

const Video = model('Video', videoSchema);

export default Video;
