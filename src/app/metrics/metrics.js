import Translation from '../translator/Translation';
import Review from '../review/Review';

const metrics = async function serviceMetrics(req, res, next) {
  try {
    const timestampFilter = req.query.timestamp
      ? new Date(req.query.timestamp)
      : new Date(0);

    const queries = {
      translationsCountQuery: {
        translation: { $exists: true },
        createdAt: { $gte: timestampFilter },
      },
      reviewsCountQuery: {
        review: { $exists: true },
        createdAt: { $gte: timestampFilter },
      },
      ratingsCountQuery: [
        { $match: { createdAt: { $gte: timestampFilter } } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $project: { rating: '$_id', count: 1, _id: 0 } },
      ],
    };

    const [translationsCount, reviewsCount, ratingsCounters] = await Promise.all([
      Translation.countDocuments(queries.translationsCountQuery),
      Review.countDocuments(queries.reviewsCountQuery),
      Review.aggregate(queries.ratingsCountQuery),
    ]);

    return res.status(200).json({ translationsCount, reviewsCount, ratingsCounters });
  } catch (error) {
    return next(error);
  }
};

export default metrics;
