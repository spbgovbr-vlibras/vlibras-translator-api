'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const materializedViewSql = `
      CREATE MATERIALIZED VIEW "view_reviews" AS 
      SELECT COUNT(*) 
      FROM "Reviews" 
      WHERE "translationId" IS NOT NULL 
      AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
    `;

    await queryInterface.sequelize.query(materializedViewSql);
  },

  async down(queryInterface, Sequelize) {
    const dropViewSql = `DROP MATERIALIZED VIEW IF EXISTS "view_reviews";`;
    await queryInterface.sequelize.query(dropViewSql);
  },
};
      