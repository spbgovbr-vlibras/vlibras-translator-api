import mongoose from 'mongoose';

const translationSchema = new mongoose.Schema({
	text: { type: String, required: true },
	translation: String,
	requester: { type: String, required: true }
}, { timestamps: true, versionKey: false });

const Translation = mongoose.model('Translation', translationSchema)

export default Translation;
