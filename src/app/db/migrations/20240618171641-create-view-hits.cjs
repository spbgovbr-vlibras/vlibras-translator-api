'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const materializedViewSql = `
      CREATE MATERIALIZED VIEW "view_hits" AS 
      SELECT "text", COUNT(*) as 
      occurrences FROM "Hits" GROUP BY "text" ORDER BY occurrences DESC LIMIT 10;
    `;

    await queryInterface.sequelize.query(materializedViewSql);
  },

  async down(queryInterface, Sequelize) {
    const dropViewSql = `DROP MATERIALIZED VIEW IF EXISTS "view_hits";`;
    await queryInterface.sequelize.query(dropViewSql);
  },
};
    