import createError from 'http-errors';
import db from '../db/models/index.js';
import { serverError } from '../util/debugger.js';
import { METRICS_ERROR } from '../../config/error.js';
import fetchAggregatedMetrics, { isAggregateUnavailable } from './metricsRepository.js';

const HITS_LIMIT = 10;

// O máximo do Date do JS seria serializado como "+275760-09-13T00:00:00.000Z",
// ano estendido que o Postgres recusa como timestamptz.
const MAX_TIMESTAMP_MS = Date.parse('9999-12-31T00:00:00.000Z');

/**
 * Resolve o intervalo consultado. O fim é tratado como exclusivo para que um
 * pedido de dia cheio (23:59:59.999) caia na fronteira do dia e possa ser
 * respondido pela pré-agregação.
 *
 * @param {Request} req - A requisição http(s).
 * @returns {{startMs: number, endExclusiveMs: number}}
 */
const resolveRange = function resolveRange(req) {
  // O validador troca req.query pelos valores já convertidos, então os
  // timestamps chegam como número: startTime=0 é um pedido legítimo e falsy.
  const informed = (value) => value !== undefined && value !== null && value !== '';

  return {
    startMs: informed(req.query.startTime) ? Number(req.query.startTime) : 0,
    endExclusiveMs: informed(req.query.endTime)
      ? Number(req.query.endTime) + 1
      : MAX_TIMESTAMP_MS,
  };
};

/**
 * Conta direto nas tabelas. Serve enquanto a migration de pré-agregação não
 * roda ou as views ainda não foram populadas.
 *
 * @param {{startMs: number, endExclusiveMs: number}} range - Intervalo pedido.
 * @returns {Promise<object>} Métricas cruas.
 */
const fetchMetricsFromTables = async function fetchMetricsFromTables(range) {
  const startTime = new Date(range.startMs);
  const endTime = new Date(range.endExclusiveMs - 1);

  return db.sequelize.transaction(async (t) => {
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

    for (const rating of ratings) {
      rating.rating = rating.rating ? 'good' : 'bad';
    }

    const hits = await db.Hit.findAll({
      attributes: [
        [db.sequelize.col('text'), '_id'],
        [db.sequelize.fn('SUM', db.sequelize.col('hits')), 'hits'],
      ],
      group: ['text'],
      order: [[db.sequelize.fn('SUM', db.sequelize.col('hits')), 'DESC']],
      limit: HITS_LIMIT,
      transaction: t,
    });

    return {
      translations,
      reviews,
      ratings,
      hits,
    };
  });
};

const metrics = async function serviceMetrics(req, res, next) {
  const range = resolveRange(req);

  try {
    let result;
    try {
      result = await fetchAggregatedMetrics(range, HITS_LIMIT);
    } catch (error) {
      if (!isAggregateUnavailable(error)) {
        throw error;
      }
      serverError('Metrics aggregates unavailable, falling back to table scan');
      result = await fetchMetricsFromTables(range);
    }

    return res.status(200).json({
      translationsCount: result.translations,
      reviewsCount: result.reviews,
      ratingsCounters: result.ratings,
      translationsHits: result.hits,
    });
  } catch (error) {
    serverError(error.message);
    return next(createError(500, METRICS_ERROR.metricsError));
  }
};

export default metrics;
