export default {
  async up(queryInterface, Sequelize) {
    console.log('Criando índice em "Translations"...');

    // criar índice parcial na tabela Translations
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_translations_createdAt_notnull
      ON "Translations" ("createdAt")
      WHERE "translation" IS NOT NULL;
    `);

    console.log('Índice em "Translations" criado com sucesso!');
  },

  async down(queryInterface, Sequelize) {
    console.log('Revertendo a criação do índice em "Translations"...');
    
    // remover índice parcial na tabela Translations
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_translations_createdAt_notnull;
    `);

    console.log('Índice em "Translations" revertido com sucesso!');
  }
};