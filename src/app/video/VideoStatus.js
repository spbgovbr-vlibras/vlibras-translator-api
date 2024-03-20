import mongoose from 'mongoose';
const {Schema, model} = mongoose;

import { VIDEO_STATUS } from '../../config/status.js';

const options = {
  timestamps: true,
  versionKey: false,
};

const videoStatus = new Schema({
  status: {
    type: String,
    enum: Object.values(VIDEO_STATUS),
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
}, options);


// model created on video core
const VideoStatus = model('status_videos_translations', videoStatus);

export default VideoStatus;
