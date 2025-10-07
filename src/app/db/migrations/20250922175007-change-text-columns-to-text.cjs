'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Translations: text, translation -> TEXT
      await queryInterface.changeColumn(
        'Translations',
        'text',
        { type: Sequelize.TEXT },
        { transaction }
      );
      await queryInterface.changeColumn(
        'Translations',
        'translation',
        { type: Sequelize.TEXT },
        { transaction }
      );

      // Reviews: review -> TEXT
      await queryInterface.changeColumn(
        'Reviews',
        'review',
        { type: Sequelize.TEXT },
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Reverter para STRING(5000)
      await queryInterface.changeColumn(
        'Translations',
        'text',
        { type: Sequelize.STRING(5000) },
        { transaction }
      );
      await queryInterface.changeColumn(
        'Translations',
        'translation',
        { type: Sequelize.STRING(5000) },
        { transaction }
      );
      await queryInterface.changeColumn(
        'Reviews',
        'review',
        { type: Sequelize.STRING(5000) },
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
