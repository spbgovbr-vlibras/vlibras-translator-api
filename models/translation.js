import mongoose from 'mongoose';

const translationSchema = new mongoose.Schema({
    translationTag: { type: String, unique: true, required: true },
    text: { type: String, required: true },
    translation: String,
    rating: { type: String, enum: ['good', 'bad'] },
    review: String
}, { timestamps: true, versionKey: false });

const Translation = mongoose.model('Translation', translationSchema)

export default Translation;