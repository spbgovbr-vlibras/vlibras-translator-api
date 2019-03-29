import express from 'express';
import { check } from 'express-validator/check';
import review from '../controllers/translationReview';

const reviewRouter = express.Router();

reviewRouter.post('/review', [
    check('text').not().isEmpty(),
    check('translation').not().isEmpty(),
    check('rating').matches(/^good$|^bad$/)
], review);

export default reviewRouter;
