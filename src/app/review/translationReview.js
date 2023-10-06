import { Review } from "../db/models"

const translationReview = async function translationReviewController(req, res, next) {
  try {
    // const reviewRequest = new Review({
    //   text: req.body.text,
    //   translation: req.body.translation,
    //   rating: req.body.rating,
    //   review: req.body.review || '',
    //   requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    // });

    // const review = new Review({
    //   translationId: 1,
    //   rating: false,
    //   review: 'ruim',
    //   requester: 'eu'
    // });

    const rating = req.body.rating === "good";

    await Review.create({
      translationId: req.body.translation,
      rating: rating,
      review: req.body.review || '',
      requester: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    });

    // await Review.save();
    return res.sendStatus(200);
  } catch (error) {
    return next(error);
  }
};

export default translationReview;
