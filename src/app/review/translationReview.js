import { Review } from "../db/models"
import { Translation } from "../db/models"
import db from '../db/models';

const translationReview = async function translationReviewController(req, res, next) {
  try {
    await db.sequelize.transaction(async (t) => {
      const translation = await Translation.findOne({
        where: { translation: req.body.translation }, 
        transaction: t 
      });
      const reviewRequest = Review.build({
        translationId: translation.id,
        rating: req.body.rating === 'good',
        review: req.body.review || '',
        requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      });

      await reviewRequest.save();
    });
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};

export default translationReview;
