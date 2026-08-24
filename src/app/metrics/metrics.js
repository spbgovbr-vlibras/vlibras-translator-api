import createError from 'http-errors';
import db from '../db/models/index.js';
import env from '../../config/environments/environment.js';
import { serverError } from '../util/debugger.js';
import { METRICS_ERROR } from '../../config/error.js';
import { METRICS_STATEMENT_TIMEOUT } from '../../config/timeout.js';

const HITS_RANKING_SIZE = 10;

const resolveStatementTimeout = function resolveMetricsStatementTimeout(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const buildPeriodFilter = function buildMetricsPeriodFilter(query, Op) {
  const period = {};

  if (query.startTime !== undefined) {
    period[Op.gte] = new Date(query.startTime);
  }

  if (query.endTime !== undefined) {
    period[Op.lte] = new Date(query.endTime);
  }

  if (Object.getOwnPropertySymbols(period).length === 0) {
    return {};
  }

  return { createdAt: period };
};

const createMetricsService = function createServiceMetricsHandler({
  models = db,
  statementTimeout = METRICS_STATEMENT_TIMEOUT,
} = {}) {
  const { sequelize, Sequelize } = models;
  const { Op } = Sequelize;
  const timeout = resolveStatementTimeout(statementTimeout, METRICS_STATEMENT_TIMEOUT);

  const runBounded = (query) => sequelize.transaction(async (transaction) => {
    await sequelize.query(`SET LOCAL statement_timeout = ${timeout}`, { transaction });

    return query(transaction);
  });

  const countTranslations = (period) => runBounded((transaction) => models.Translation.count({
    where: {
      translation: { [Op.not]: null },
      ...period,
    },
    transaction,
  }));

  const countReviews = (period) => runBounded((transaction) => models.Review.count({
    where: {
      review: { [Op.not]: null },
      ...period,
    },
    transaction,
  }));

  const countRatings = (period) => runBounded((transaction) => models.Review.findAll({
    attributes: ['rating', [sequelize.fn('COUNT', sequelize.col('rating')), 'count']],
    where: period,
    group: ['rating'],
    raw: true,
    transaction,
  }));

  const rankHits = () => runBounded((transaction) => models.Hit.findAll({
    attributes: [
      [sequelize.col('text'), '_id'],
      [sequelize.fn('SUM', sequelize.col('hits')), 'hits'],
    ],
    group: ['text'],
    order: [[sequelize.fn('SUM', sequelize.col('hits')), 'DESC']],
    limit: HITS_RANKING_SIZE,
    raw: true,
    transaction,
  }));

  const collect = async function collectServiceMetrics(query) {
    const period = buildPeriodFilter(query, Op);

    const translations = await countTranslations(period);
    const reviews = await countReviews(period);
    const ratings = await countRatings(period);
    const hits = await rankHits();

    return {
      translationsCount: translations,
      reviewsCount: reviews,
      ratingsCounters: ratings.map((entry) => ({
        ...entry,
        rating: entry.rating ? 'good' : 'bad',
      })),
      translationsHits: hits,
    };
  };

  const handler = async function serviceMetrics(req, res, next) {
    try {
      const payload = await collect(req.query);

      return res.status(200).json(payload);
    } catch (error) {
      serverError(error.message);

      return next(createError(500, METRICS_ERROR.metricsError));
    }
  };

  return { collect, handler };
};

const metrics = createMetricsService({
  statementTimeout: resolveStatementTimeout(
    env.METRICS_STATEMENT_TIMEOUT_MS,
    METRICS_STATEMENT_TIMEOUT,
  ),
}).handler;

export default metrics;
export {
  createMetricsService,
  buildPeriodFilter,
  resolveStatementTimeout,
};
