/* eslint-disable no-console */
import Translation from '../translator/Translation';
import Review from '../review/Review';
import VideoStatus from '../video/VideoStatus';
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
        { $group: { _id: null, count: { $sum: '$duration' } } },
        { $project: { count: 1, _id: 0 } },
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
      videosDurationSum,
    ] = await Promise.all([
      Translation.countDocuments(queries.translationsCountQuery),
      Hit.aggregate(queries.hitsCountQuery).allowDiskUse(true),
      Review.countDocuments(queries.reviewsCountQuery),
      Review.aggregate(queries.ratingsCountQuery).allowDiskUse(true),
      VideoStatus.aggregate(queries.videosCountQuery).allowDiskUse(true),
      VideoStatus.aggregate(queries.videosDurationSumQuery).allowDiskUse(true),
    ]);

    let count = 0;


    if (Array.isArray(videosDurationSum) && videosDurationSum.length > 0) {
      count = videosDurationSum[0].count;
    }
    console.log(videosDurationSum);

    return res.status(200).json({
      translationsCount,
      reviewsCount,
      ratingsCounters,
      translationsHits,
      videosDurationSum: count, // videos duration sum in ms
      videosCounters,
    });
  } catch (error) {
    return next(error);
  }
};

export default metrics;
