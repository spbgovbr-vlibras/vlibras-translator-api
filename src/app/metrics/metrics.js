import Translation from '../translator/Translation';
import Review from '../review/Review';
import Video from '../video/Video';
import Hit from '../translator/Hit';

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
      videosCountQuery: [
        { $match: { createdAt: { $gte: startTime, $lt: endTime } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ],
      videosDurationSumQuery: [
        { $match: { createdAt: { $gte: startTime, $lt: endTime } } },
        { $group: { _id: '$duration', videosDurationSum: { $sum: '$duration' } } },
        { $project: { videosDurationSum: 1, _id: 0 } },
      ],
      hitsCountQuery: [
        {
          $project: {
            text: 1, hits: 1,
          },
        },
        { $group: { _id: '$text', hits: { $sum: 1 } } },
        { $sort: { hits: -1 } },
        { $limit: 10 },
      ],
    };

    const [
      translationsCount,
      translationsHits,
      reviewsCount,
      ratingsCounters,
      videosCounters,
      [videosDurationSum],
    ] = await Promise.all([
      Translation.countDocuments(queries.translationsCountQuery),
      Hit.aggregate(queries.hitsCountQuery),
      Review.countDocuments(queries.reviewsCountQuery),
      Review.aggregate(queries.ratingsCountQuery),
      Video.aggregate(queries.videosCountQuery),
      Video.aggregate(queries.videosDurationSumQuery),
    ]);

    return res.status(200).json({
      translationsCount,
      reviewsCount,
      ratingsCounters,
      translationsHits,
      ...videosDurationSum, // videos duration sum in ms
      videosCounters,
    });
  } catch (error) {
    return next(error);
  }
};

export default metrics;
