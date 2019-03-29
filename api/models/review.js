import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    text: { type: String, required: true },
    translation: { type: String, required: true },
    rating: { type: String, enum: ['good', 'bad'], required: true },
    review: String,
    requester: { type: String, required: true }
}, { timestamps: true, versionKey: false });

const Review = mongoose.model('Review', reviewSchema)

export default Review;