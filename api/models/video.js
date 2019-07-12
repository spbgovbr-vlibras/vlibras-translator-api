import mongoose from 'mongoose';
import { STATUS } from '../config/videoParameters';

const videoSchema = new mongoose.Schema({
	gloss: { type: String, required: true },
	uid: { type: String, required: true },
	path: { type: String },
	size: { type: Number },
	duration: { type: Number },
	status: { type: String, enum: Object.values(STATUS), required: true },
	requester: { type: String, required: true }
}, { timestamps: true, versionKey: false });

const Video = mongoose.model('Video', videoSchema)

export default Video;
