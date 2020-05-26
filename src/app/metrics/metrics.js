import Translation from '../translator/Translation';
import Review from '../review/Review';

const metrics = async function serviceMetrics(_req, res, next) {
  try {
    const translationCount = await Translation.countDocuments({
      translation: {
        $exists: true,
      },
    });

    const reviewCount = await Review.countDocuments({
      review: {
        $exists: true,
      },
    });

    const ratingCount = await Review.aggregate()
      .group({ _id: '$rating', count: { $sum: 1 } })
      .project({ rating: '$_id', count: 1, _id: 0 });


    return res.status(200).json({ translationCount, reviewCount, ratingCount });
  } catch (error) {
    return next(error);
  }
};

export default metrics;
