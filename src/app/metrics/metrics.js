import createError from 'http-errors';
import db from '../db/models/index.js';
import { serverError } from '../util/debugger.js';
import { METRICS_ERROR } from '../../config/error.js';

const metrics = async function serviceMetrics(req, res, next) {
  try {
    const startTime = req.query.startTime ? new Date(req.query.startTime) : new Date(0);
    const endTime = req.query.endTime ? new Date(req.query.endTime) : new Date(8640000000000000);

    
    const result = await db.sequelize.transaction(async (t) => {

      // SELECT COUNT(*) FROM "Translations" WHERE translation IS NOT NULL AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
      // CREATE MATERIALIZED VIEW "view_translations" AS SELECT COUNT(*) FROM "Translations" WHERE translation IS NOT NULL AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
      // REFRESH MATERIALIZED VIEW "view_translations";
      // SELECT * FROM "view_translations";

      // const translations = await db.Translation.count({
      //   where: {
      //     translation: { [db.Sequelize.Op.not]: null },
      //     createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
      //   },
      //   transaction: t,
      // });

      const translations = await db.sequelize.query('SELECT  * FROM "view_translations"', {
        transaction: t,
      });


      // SELECT COUNT(*) FROM "Reviews" WHERE "translationId" IS NOT NULL AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
      // CREATE MATERIALIZED VIEW "view_reviews" AS SELECT COUNT(*) FROM "Reviews" WHERE "translationId" IS NOT NULL AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
      // REFRESH MATERIALIZED VIEW "view_reviews";
      // SELECT * FROM "view_reviews";


      // const reviews = await db.Review.count({
      //   where: {
      //     review: { [db.Sequelize.Op.not]: null },
      //     createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
      //   },
      //   transaction: t,
      // });

      const reviews = await db.sequelize.query('SELECT * FROM "view_reviews"', {
        transaction: t,
      });

      // SELECT CASE WHEN rating = true THEN 'good' ELSE 'bad' END as rating_status, COUNT(*) as occurrences FROM "Reviews" GROUP BY rating_status;
      // CREATE MATERIALIZED VIEW "view_rating" AS SELECT CASE WHEN rating = true THEN 'good' ELSE 'bad' END as rating_status, COUNT(*) as occurrences FROM "Reviews" GROUP BY rating_status;
      // REFRESH MATERIALIZED VIEW "view_rating";
      // SELECT * FROM "view_rating";

      // const ratings = await db.Review.findAll({
      //   attributes: ['rating', [db.Sequelize.fn('COUNT', db.sequelize.col('rating')), 'count']],
      //   where: {
      //     createdAt: { [db.Sequelize.Op.between]: [startTime, endTime] },
      //   },
      //   group: ['rating'],
      //   transaction: t,
      // });

      // for (const rating of ratings) {
      //   rating.rating = rating.rating ? "good" : "bad";
      // }

      const ratings = await db.sequelize.query('SELECT * FROM "view_rating"', {
        transaction: t,
      });
      
    //SELECT "text", COUNT(*) as occurrences FROM "Hits" GROUP BY "text" ORDER BY occurrences DESC LIMIT 10;
    // CREATE MATERIALIZED VIEW "view_hits" AS SELECT "text", COUNT(*) as occurrences FROM "Hits" GROUP BY "text" ORDER BY occurrences DESC LIMIT 10;
    // REFRESH MATERIALIZED VIEW "view_hits";
    // SELECT * FROM "view_hits";

      // const hits = await db.Hit.findAll({
      //   attributes: [
      //     [db.sequelize.col('text'), '_id'],
      //     [db.sequelize.fn('SUM', db.sequelize.col('hits')), 'hits']
      //   ],
      //   group: ['text'],
      //   order: [[db.sequelize.fn('SUM', db.sequelize.col('hits')), 'DESC']],
      //   limit: 10,
      //   transaction: t,
      // });

      const hits = await db.sequelize.query('SELECT * FROM "view_hits"', {
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
      translationsCount: result.translations[1].rows[0].count,
      reviewsCount: result.reviews[1].rows[0].count,
      ratingsCounters: result.ratings[0],
      translationsHits: result.hits[0],
    });
  } catch (error) {
    serverError(error.message)
    return next(createError(500, METRICS_ERROR.metricsError));
  }
};

export default metrics;
