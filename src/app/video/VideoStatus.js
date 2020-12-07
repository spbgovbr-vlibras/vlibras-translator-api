import { Schema, model } from 'mongoose';

import { VIDEO_STATUS } from '../../config/status';

const options = {
  timestamps: true,
  versionKey: false,
};

const videoStatus = new Schema({
  translation: {
    type: Schema.Types.ObjectId,
    ref: 'Video',
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(VIDEO_STATUS),
    required: true,
  },
}, options);

videoStatus.pre(/^find/, function populateSignerSchema() {
  this.populate({ path: 'videos' });
});

// model created on video core
const VideoStatus = model('status_videos_translations', videoStatus);

export default VideoStatus;
