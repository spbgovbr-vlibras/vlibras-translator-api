import { Review } from "../db/models"
import { Translation } from "../db/models"

const translationReview = async function translationReviewController(req, res, next) {
  try {

    const translation = await Translation.findOne( { where: {translation: req.body.translation} } );
    const reviewRequest = new Review({
      translationId: translation.id,
      rating: req.body.rating === 'good',
      review: req.body.review || '',
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    await reviewRequest.save();
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};

export default translationReview;
