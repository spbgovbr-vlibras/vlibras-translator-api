import mongoose from 'mongoose';
import { STATUS, EXPIRATION_TIME } from '../config/video';

const videoSchema = new mongoose.Schema({
	gloss: { type: String, required: true },
	uid: { type: String, unique: true, required: true },
	path: { type: String },
	size: { type: Number },
	duration: { type: Number },
	status: { type: String, enum: Object.values(STATUS), required: true },
	requester: { type: String, required: true }
}, { timestamps: true, versionKey: false });

const virtual = videoSchema.virtual('expired');

virtual.get(function() {
	const time = Math.abs(Date.now() - this.updatedAt);
	return time > EXPIRATION_TIME;
});

const Video = mongoose.model('Video', videoSchema)

export default Video;
