'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Criar a view materializada "view_hits"
    const materializedViewSql = `
      CREATE MATERIALIZED VIEW "view_hits" AS 
      SELECT "text", COUNT(*) as occurrences 
      FROM "Hits" 
      GROUP BY "text" 
      ORDER BY occurrences DESC 
      LIMIT 10;
    `;
    await queryInterface.sequelize.query(materializedViewSql);

    // Agendar a atualização da view materializada usando pg_cron
    const scheduleRefreshSql = `
      SELECT cron.schedule('refresh_view_hits', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW "view_hits"');
    `;
    await queryInterface.sequelize.query(scheduleRefreshSql);
  },

  async down(queryInterface, Sequelize) {
    // Remover o agendamento do pg_cron
    const dropScheduleSql = `
      SELECT cron.unschedule('refresh_view_hits');
    `;
    await queryInterface.sequelize.query(dropScheduleSql);

    // Remover a view materializada
    const dropViewSql = `DROP MATERIALIZED VIEW IF EXISTS "view_hits";`;
    await queryInterface.sequelize.query(dropViewSql);
  },
};