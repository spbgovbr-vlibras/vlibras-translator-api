'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const materializedViewSql = `
      CREATE MATERIALIZED VIEW "view_translations" AS
      SELECT COUNT(*)
      FROM "Translations"
      WHERE translation IS NOT NULL
      AND "createdAt" BETWEEN '1970-01-01' AND '2070-01-01';
    `;

    await queryInterface.sequelize.query(materializedViewSql);
  },

  async down(queryInterface, Sequelize) {
    const dropViewSql = `DROP MATERIALIZED VIEW IF EXISTS "view_translations";`;
    await queryInterface.sequelize.query(dropViewSql);
  },
};
