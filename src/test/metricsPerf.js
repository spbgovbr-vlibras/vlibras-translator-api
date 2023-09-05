import { performance } from 'perf_hooks'
import mongoConnection from '../app/util/mongoConnection.js';
import env from '../config/environments/environment';
import Translation from '../app/translator/Translation.js';
import Review from '../app/review/Review.js';
import VideoStatus from '../app/video/VideoStatus.js';
import Hit from '../app/translator/Hit.js';

mongoConnection();
runQueries();

async function measurePerf(func) {
  const startTime = performance.now();
  const r = await func();
  const endTime = performance.now();
  return [endTime - startTime, r]
}

async function runQueries() {
  const startTime = new Date(0);
  const endTime = new Date(8640000000000000);

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

  const [translationsCountTime, translationsCount] = await measurePerf(() => Translation.countDocuments(queries.translationsCountQuery));

  const [translationHitsTime, translationsHits] = await measurePerf(() => Hit.aggregate(queries.hitsCountQuery).allowDiskUse(true));

  const [reviewsCountTime, reviewsCount] = await measurePerf(() => Review.countDocuments(queries.reviewsCountQuery));

  const [ratingsCountersTime, ratingsCounters] = await measurePerf(() => Review.aggregate(queries.ratingsCountQuery).allowDiskUse(true));

  const [videosCountersTime, videosCounters] = await measurePerf(() => VideoStatus.aggregate(queries.videosCountQuery).allowDiskUse(true));

  const [videosDurationSumTime, videosDurationSum] = await measurePerf(() => VideoStatus.aggregate(queries.videosDurationSumQuery).allowDiskUse(true));

  let count = 0;

  if (Array.isArray(videosDurationSum) && videosDurationSum.length > 0) {
    count = videosDurationSum[0].count;
  }
  console.log(videosDurationSum);

  const response = {
    translationsCount,
    reviewsCount,
    ratingsCounters,
    translationsHits,
    videosDurationSum: count, // videos duration sum in ms
    videosCounters,
  }
  const responseTimes = {
    translationsCountTime,
    reviewsCountTime,
    ratingsCountersTime,
    translationHitsTime,
    videosDurationSumTime,
    videosCountersTime,
  }

  console.log(response);
  console.log('\nTempos de resposta em milisegundos:');
  console.log(responseTimes);
}
