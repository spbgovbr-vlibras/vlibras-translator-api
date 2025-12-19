import createError from 'http-errors';
import db from '../db/models/index.js';
import { serverError } from '../util/debugger.js';
import { METRICS_ERROR } from '../../config/error.js';

const metrics = async function serviceMetrics(req, res, next) {
  try {
    const hasDateFilter = !!(req.query.startTime && req.query.endTime);

    const startTime = hasDateFilter ? new Date(req.query.startTime) : null;
    const endTime = hasDateFilter ? new Date(req.query.endTime) : null;

    const result = await db.sequelize.transaction(async (t) => {
      let translations;

      if (hasDateFilter) {
        translations = await db.Translation.count({
          where: {
            translation: { [db.Sequelize.Op.not]: null },
            createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
          },
          transaction: t,
        });
      } 
      
      else {
        const rows = await db.sequelize.query(
          'SELECT total_translation_count FROM translations_count LIMIT 1',
          { type: db.Sequelize.QueryTypes.SELECT, transaction: t }
        );

        translations = rows?.[0]?.total_translation_count ?? 0;
      }


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

      for (const rating of ratings) {
        rating.rating = rating.rating ? "good" : "bad";
      }
      
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
        hits,
      };
    });

    return res.status(200).json({
      translationsCount: result.translations,
      reviewsCount: result.reviews,
      ratingsCounters: result.ratings,
      translationsHits: result.hits,
    });
  } catch (error) {
    serverError(error.message)
    return next(createError(500, METRICS_ERROR.metricsError));
  }
};

export default metrics;
