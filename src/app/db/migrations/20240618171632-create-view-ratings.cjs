'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const materializedViewSql = `
      CREATE MATERIALIZED VIEW "view_rating" AS 
      SELECT CASE 
      WHEN rating = true THEN 'good' ELSE 'bad' END as 
      rating_status, COUNT(*) as occurrences FROM "Reviews" GROUP BY rating_status;
    `;

    await queryInterface.sequelize.query(materializedViewSql);
  },

  async down(queryInterface, Sequelize) {
    const dropViewSql = `DROP MATERIALIZED VIEW IF EXISTS "view_rating";`;
    await queryInterface.sequelize.query(dropViewSql);
  },
};