import db from '../db/models';

const metrics = async function serviceMetrics(req, res, next) {
  try {
    const startTime = req.query.startTime ? new Date(req.query.startTime) : new Date(0);
    const endTime = req.query.endTime ? new Date(req.query.endTime) : new Date(8640000000000000);

    const result = await db.sequelize.transaction(async (t) => {
      const translations = await db.Translation.count({
        where: {
          translation: { [db.Sequelize.Op.not]: null },
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        transaction: t,
      });

      const reviews = await db.Review.count({
        where: {
          review: { [db.Sequelize.Op.not]: null },
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        transaction: t,
      });

      const ratings = await db.Review.findAll({
        attributes: ['rating', [db.Sequelize.fn('COUNT', db.sequelize.col('rating')), 'count']],
        where: {
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        group: ['rating'],
        transaction: t,
      });

      const videos = await db.VideoStatus.count({
        where: {
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        group: ['status'],
        transaction: t,
      });

      const videosDuration = await db.VideoStatus.sum('duration', {
        where: {
          createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
        },
        transaction: t,
      });

      const hits = await db.Hit.findAll({
        attributes: [
          [db.sequelize.col('text'), '_id'], 
          [db.sequelize.fn('SUM', db.sequelize.col('hits')), 'hits']
        ],
        group: ['text'],
        order: [[db.sequelize.fn('SUM', db.sequelize.col('hits')), 'DESC']],
        limit: 10,
        transaction: t,
      });

      return {
        translations,
        reviews,
        ratings,
        videosResult,
        videosDuration,
        hits,
      };
    });

    return res.status(200).json({
      translationsCount: result.translations,
      translationsHits: result.hits,
      reviewsCount: result.reviews,
      ratingsCounters: result.ratings.rows,
      videosCounters: result.videos.rows,
      videosDurationSum: result.videosDuration || 0,
    });
  } catch (error) {
    return next(error);
  }
};

export default metrics;
