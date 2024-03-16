import createError from 'http-errors';
import { serverError } from '../util/debugger.js';
import { REVIEW_ERROR } from '../../config/error.js';
import db from '../db/models/index.js';

const translationReview = async function translationReviewController(req, res, next) {
  try {
    await db.sequelize.transaction(async (t) => {
      let translation = await db.Translation.findOne({
        where: { translation: req.body.translation },
        transaction: t
      });

      if (!translation) {
        translation = db.Translation.build({
          text: req.body.text,
          translation: req.body.translation,
          requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        });

        await translation.save({ transaction: t });
      }

      const reviewRequest = db.Review.build({
        translationId: translation.id,
        rating: req.body.rating === 'good',
        review: req.body.review || '',
        requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      });

      await reviewRequest.save({ transaction: t });
    });
    return res.sendStatus(200);
  } catch (error) {
    serverError(error.message)
    return next(createError(500, REVIEW_ERROR.reviewError));
  }
};

export default translationReview;
