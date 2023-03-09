import { Schema, model } from 'mongoose';

const options = {
  timestamps: true,
  versionKey: false,
};

const accessSchema = new Schema({
  requestsAmount: {
    type: Number,
    required: true,
  },
  wordsAmount: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  site: {
    type: String,
    required: true,
  },
}, options);

const DailyAccess = model('DailyAccess', accessSchema);

export default DailyAccess;
