import { Schema, model } from 'mongoose';

const options = {
  timestamps: true,
  versionKey: false,
};

const hitSchema = new Schema({
  text: {
    type: String,
    required: true,
  },

  hits: {
    type: Number,
    required: true,
  },
}, options);

const Hit = model('Hit', hitSchema);

export default Hit;
