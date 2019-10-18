import Review from './Review';

const translationReview = async function translationReviewController(req, res, next) {
  try {
    const reviewRequest = new Review({
      text: req.body.text,
      translation: req.body.translation,
      rating: req.body.rating,
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
