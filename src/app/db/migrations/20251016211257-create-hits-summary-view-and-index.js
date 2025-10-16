export default {
  async up(queryInterface, Sequelize) {
    console.log('Criando materialized view e índice em "Hits"...');

    // criar materialized view "hits_summary"
    await queryInterface.sequelize.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS hits_summary AS
      SELECT "text", SUM("hits") AS total_hits
      FROM "Hits"
      GROUP BY "text";
    `);

    // criar índice na view para otimizar ORDER BY
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_hits_summary_hits
      ON hits_summary (total_hits DESC);
    `);

    // atualizar as estatísticas
    await queryInterface.sequelize.query(`
      VACUUM ANALYZE "Hits";
    `);

    await queryInterface.sequelize.query(`
      ANALYZE hits_summary;
    `);

    console.log('Materialized view e índice em "Hits" criados com sucesso!');
  },

  async down(queryInterface, Sequelize) {
    console.log('Revertendo a criação da materialized view e índice em "Hits"...');

    // remover índice da materialized view
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_hits_summary_hits;
    `);

    // remover materialized view "hits_summary"
    await queryInterface.sequelize.query(`
      DROP MATERIALIZED VIEW IF EXISTS hits_summary;
    `);

    console.log('Materialized view e índice em "Hits" revertidos com sucesso!');
  }
};