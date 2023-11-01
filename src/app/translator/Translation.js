import { Schema, model } from 'mongoose';

const options = {
  timestamps: true,
  versionKey: false,
};

const translationSchema = new Schema({
  text: {
    type: String,
    required: true,
  },

  translation: String,

  requester: {
    type: String,
    required: true,
  },
}, options);

const Translation = model('Translation', translationSchema);

export default Translation;
