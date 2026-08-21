import { QueryTypes } from 'sequelize';
import db from '../db/models/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// undefined_table: migration não aplicada.
// object_not_in_prerequisite_state: view criada WITH NO DATA e nunca populada.
const UNDEFINED_TABLE = '42P01';
const NOT_POPULATED = '55000';

/**
 * Indica que a pré-agregação não está disponível e o chamador deve usar o
 * caminho legado.
 *
 * @param {Error} error - Erro devolvido pelo Sequelize.
 * @returns {boolean}
 */
export const isAggregateUnavailable = function isAggregateUnavailable(error) {
  const code = error?.parent?.code ?? error?.original?.code ?? error?.code;
  return code === UNDEFINED_TABLE || code === NOT_POPULATED;
};

const floorUtcDay = (milliseconds) => Math.floor(milliseconds / DAY_MS) * DAY_MS;
const ceilUtcDay = (milliseconds) => Math.ceil(milliseconds / DAY_MS) * DAY_MS;
const toIso = (milliseconds) => new Date(milliseconds).toISOString();

const splitRange = function splitRange({ startMs, endExclusiveMs }, lastAggregatedDay) {
  // O limite vem de max(day), e não do relógio: se o refresh atrasar, a borda
  // contada nas tabelas cresce e o resultado continua exato.
  const aggregatedUpperBoundMs = lastAggregatedDay
    ? Date.parse(`${lastAggregatedDay}T00:00:00.000Z`) + DAY_MS
    : Number.NEGATIVE_INFINITY;

  const fullEndMs = Math.max(
    Math.min(floorUtcDay(endExclusiveMs), aggregatedUpperBoundMs),
    startMs,
  );
  const fullStartMs = Math.min(ceilUtcDay(startMs), fullEndMs);

  return { fullStartMs, fullEndMs };
};

const buildParams = function buildParams(range, lastAggregatedDay) {
  const { fullStartMs, fullEndMs } = splitRange(range, lastAggregatedDay);

  return [
    toIso(range.startMs),
    toIso(range.endExclusiveMs),
    toIso(fullStartMs),
    toIso(fullEndMs),
    toIso(fullStartMs).slice(0, 10),
    toIso(fullEndMs).slice(0, 10),
  ];
};

const fetchAggregatedBounds = async function fetchAggregatedBounds(transaction) {
  const [bounds] = await db.sequelize.query(
    `SELECT
       (SELECT max(day)::text FROM metrics_translations_daily) AS translations,
       (SELECT max(day)::text FROM metrics_reviews_daily) AS reviews;`,
    { type: QueryTypes.SELECT, transaction },
  );

  return bounds;
};

const countTranslations = async function countTranslations(range, lastAggregatedDay, transaction) {
  const [result] = await db.sequelize.query(
    `SELECT
       (SELECT COALESCE(sum(total), 0)
          FROM metrics_translations_daily
         WHERE day >= $5::date AND day < $6::date) AS aggregated,
       (SELECT count(*)
          FROM "Translations"
         WHERE translation IS NOT NULL
           AND (("createdAt" >= $1::timestamptz AND "createdAt" < $3::timestamptz)
             OR ("createdAt" >= $4::timestamptz AND "createdAt" < $2::timestamptz))) AS edges;`,
    {
      bind: buildParams(range, lastAggregatedDay),
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return Number(result.aggregated) + Number(result.edges);
};

const countReviews = async function countReviews(range, lastAggregatedDay, transaction) {
  const [result] = await db.sequelize.query(
    `WITH aggregated AS (
       SELECT
         COALESCE(sum(total), 0) AS total,
         COALESCE(sum(ratings_good), 0) AS ratings_good,
         COALESCE(sum(ratings_bad), 0) AS ratings_bad
       FROM metrics_reviews_daily
       WHERE day >= $5::date AND day < $6::date
     ),
     edges AS (
       SELECT
         count(*) FILTER (WHERE review IS NOT NULL) AS total,
         count(*) FILTER (WHERE rating IS TRUE) AS ratings_good,
         count(*) FILTER (WHERE rating IS FALSE) AS ratings_bad
       FROM "Reviews"
       WHERE ("createdAt" >= $1::timestamptz AND "createdAt" < $3::timestamptz)
          OR ("createdAt" >= $4::timestamptz AND "createdAt" < $2::timestamptz)
     )
     SELECT
       aggregated.total + edges.total AS total,
       aggregated.ratings_good + edges.ratings_good AS ratings_good,
       aggregated.ratings_bad + edges.ratings_bad AS ratings_bad
     FROM aggregated CROSS JOIN edges;`,
    {
      bind: buildParams(range, lastAggregatedDay),
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return {
    reviews: Number(result.total),
    good: Number(result.ratings_good),
    bad: Number(result.ratings_bad),
  };
};

const fetchTopHits = async function fetchTopHits(limit, transaction) {
  return db.sequelize.query(
    `SELECT text AS "_id", hits::text AS hits
       FROM metrics_hits_top
      ORDER BY position
      LIMIT $1;`,
    { bind: [limit], type: QueryTypes.SELECT, transaction },
  );
};

/**
 * Monta a resposta de /metrics a partir da pré-agregação.
 *
 * @param {object} range - Intervalo pedido, com startMs e endExclusiveMs.
 * @param {number} hitsLimit - Quantidade de posições do ranking de hits.
 * @returns {Promise<object>} Métricas no mesmo formato do caminho legado.
 */
const fetchAggregatedMetrics = async function fetchAggregatedMetrics(range, hitsLimit) {
  return db.sequelize.transaction(async (transaction) => {
    const bounds = await fetchAggregatedBounds(transaction);

    const [translations, reviews, hits] = await Promise.all([
      countTranslations(range, bounds.translations, transaction),
      countReviews(range, bounds.reviews, transaction),
      fetchTopHits(hitsLimit, transaction),
    ]);

    // O caminho legado agrupa por rating e só devolve os grupos existentes.
    // Reviews sem rating ficam fora dos dois grupos.
    const ratings = [];
    if (reviews.bad > 0) {
      ratings.push({ rating: 'bad', count: String(reviews.bad) });
    }
    if (reviews.good > 0) {
      ratings.push({ rating: 'good', count: String(reviews.good) });
    }

    return {
      translations,
      reviews: reviews.reviews,
      ratings,
      hits,
    };
  });
};

export default fetchAggregatedMetrics;
