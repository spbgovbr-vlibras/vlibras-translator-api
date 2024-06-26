'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Criar a view materializada
    const materializedViewSql = `
      CREATE MATERIALIZED VIEW "view_reviews" AS 
      SELECT COUNT(*) 
      FROM "Reviews" 
      WHERE "translationId" IS NOT NULL 
      AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
    `;
    await queryInterface.sequelize.query(materializedViewSql);

    // Agendar a atualização da view materializada usando pg_cron
    const scheduleRefreshSql = `
      SELECT cron.schedule('refresh_view_reviews', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW "view_reviews"');
    `;
    await queryInterface.sequelize.query(scheduleRefreshSql);
  },

  async down(queryInterface, Sequelize) {
    // Remover o agendamento do pg_cron
    const dropScheduleSql = `
      SELECT cron.unschedule('refresh_view_reviews');
    `;
    await queryInterface.sequelize.query(dropScheduleSql);

    // Remover a view materializada
    const dropViewSql = `DROP MATERIALIZED VIEW IF EXISTS "view_reviews";`;
    await queryInterface.sequelize.query(dropViewSql);
  },
};
