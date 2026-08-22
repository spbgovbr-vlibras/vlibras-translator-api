'use strict';

/**
 * Pré-agregação das métricas de GET /metrics. As views cobrem só dias fechados
 * em UTC e nascem WITH NO DATA; quem popula é src/app/metrics/metricsRefresher.js.
 *
 * @type {import('sequelize-cli').Migration}
 */

const CLOSED_DAYS_ONLY = `"createdAt" < (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;

/**
 * Um CREATE INDEX CONCURRENTLY abortado deixa o índice com indisvalid = false, e
 * o IF NOT EXISTS, que olha só o nome, o daria como pronto. Remove o inválido
 * antes de recriar.
 *
 * @param {import('sequelize').QueryInterface} queryInterface - Interface da migration.
 * @param {string} name - Nome do índice.
 * @param {string} statement - CREATE INDEX CONCURRENTLY correspondente.
 * @returns {Promise<void>}
 */
const createIndexConcurrently = async function createIndexConcurrently(
  queryInterface,
  name,
  statement,
) {
  const [existing] = await queryInterface.sequelize.query(
    `SELECT pg_index.indisvalid
       FROM pg_class AS index_class
       JOIN pg_index ON pg_index.indexrelid = index_class.oid
      WHERE index_class.relname = $1
        AND pg_table_is_visible(index_class.oid);`,
    { bind: [name], type: queryInterface.sequelize.QueryTypes.SELECT },
  );

  if (existing && !existing.indisvalid) {
    await queryInterface.sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS ${name};`);
  }

  await queryInterface.sequelize.query(statement);
};

module.exports = {
  async up(queryInterface) {
    // CONCURRENTLY evita travar escrita nas tabelas; em bases grandes leva minutos.
    await createIndexConcurrently(queryInterface, 'translations_created_at_idx', `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS translations_created_at_idx
        ON "Translations" ("createdAt")
        WHERE translation IS NOT NULL;
    `);

    await createIndexConcurrently(queryInterface, 'reviews_created_at_idx', `
      CREATE INDEX CONCURRENTLY IF NOT EXISTS reviews_created_at_idx
        ON "Reviews" ("createdAt");
    `);

    await queryInterface.sequelize.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_translations_daily AS
        SELECT
          ("createdAt" AT TIME ZONE 'UTC')::date AS day,
          count(*)::bigint AS total
        FROM "Translations"
        WHERE translation IS NOT NULL
          AND ${CLOSED_DAYS_ONLY}
        GROUP BY 1
      WITH NO DATA;
    `);

    await queryInterface.sequelize.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_reviews_daily AS
        SELECT
          ("createdAt" AT TIME ZONE 'UTC')::date AS day,
          count(*) FILTER (WHERE review IS NOT NULL)::bigint AS total,
          count(*) FILTER (WHERE rating IS TRUE)::bigint AS ratings_good,
          -- Rating nulo não é "bad": review sem nota fica fora dos dois grupos.
          count(*) FILTER (WHERE rating IS FALSE)::bigint AS ratings_bad
        FROM "Reviews"
        WHERE ${CLOSED_DAYS_ONLY}
        GROUP BY 1
      WITH NO DATA;
    `);

    // Topo folgado para absorver mudanças de posição entre refreshes.
    await queryInterface.sequelize.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hits_top AS
        SELECT
          row_number() OVER (ORDER BY ranked.hits DESC, ranked.text) AS position,
          ranked.text,
          ranked.hits
        FROM (
          SELECT text, sum(hits)::bigint AS hits
          FROM "Hits"
          GROUP BY text
          ORDER BY 2 DESC
          LIMIT 500
        ) AS ranked
      WITH NO DATA;
    `);

    // Índices únicos são requisito do REFRESH CONCURRENTLY. Em metrics_hits_top
    // vai em "position": "text" chega a 5000 chars e estoura o limite do B-tree.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS metrics_translations_daily_day_idx
        ON metrics_translations_daily (day);
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS metrics_reviews_daily_day_idx
        ON metrics_reviews_daily (day);
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS metrics_hits_top_position_idx
        ON metrics_hits_top (position);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS metrics_hits_top;');
    await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS metrics_reviews_daily;');
    await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS metrics_translations_daily;');
    await queryInterface.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS reviews_created_at_idx;');
    await queryInterface.sequelize.query('DROP INDEX CONCURRENTLY IF EXISTS translations_created_at_idx;');
  },
};
