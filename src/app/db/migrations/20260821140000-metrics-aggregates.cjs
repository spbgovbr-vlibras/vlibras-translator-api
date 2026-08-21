'use strict';

/**
 * Pré-agregação das métricas servidas por GET /metrics.
 *
 * As views guardam apenas dias já fechados (UTC); o dia corrente é lido direto
 * das tabelas, então o endpoint continua exato mesmo com o refresh atrasado.
 * São criadas WITH NO DATA para o deploy não ficar preso varrendo a tabela:
 * quem popula é o refresher (src/app/metrics/metricsRefresher.js).
 *
 * @type {import('sequelize-cli').Migration}
 */

const CLOSED_DAYS_ONLY = `"createdAt" < (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;

module.exports = {
  async up(queryInterface) {
    // CONCURRENTLY não roda em transação, mas evita travar escrita nas tabelas.
    // Em bases grandes esta migration leva minutos.
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS translations_created_at_idx
        ON "Translations" ("createdAt")
        WHERE translation IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
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
          count(*) FILTER (WHERE rating IS NOT TRUE)::bigint AS ratings_bad
        FROM "Reviews"
        WHERE ${CLOSED_DAYS_ONLY}
        GROUP BY 1
      WITH NO DATA;
    `);

    // O ranking de hits nunca foi filtrado por data. Materializa-se um topo
    // folgado para absorver mudanças de posição entre refreshes.
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

    // Índices únicos: requisito do REFRESH CONCURRENTLY. Em metrics_hits_top o
    // índice vai em "position" porque "text" chega a 5000 caracteres e
    // estouraria o limite de tamanho de entrada do B-tree.
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
