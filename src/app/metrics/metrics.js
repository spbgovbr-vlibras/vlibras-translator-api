import Translation from '../translator/Translation';
import Review from '../review/Review';

const metrics = async function serviceMetrics(req, res, next) {
  try {
    const startTime = req.query.startTime
      ? new Date(req.query.startTime)
      : new Date(0);

    const endTime = req.query.endTime
      ? new Date(req.query.endTime)
      : new Date(8640000000000000);

    const queries = {
      translationsCountQuery: {
        translation: { $exists: true },
        createdAt: { $gte: startTime, $lt: endTime },
      },
      reviewsCountQuery: {
        review: { $exists: true },
        createdAt: { $gte: startTime, $lt: endTime },
      },
      ratingsCountQuery: [
        { $match: { createdAt: { $gte: startTime, $lt: endTime } } },
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
