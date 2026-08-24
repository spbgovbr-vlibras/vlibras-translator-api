'use strict';

const buildQueryRunner = (queryInterface) => async (statement, bind) => {
  const [rows] = await queryInterface.sequelize.query(
    statement,
    bind ? { bind } : undefined,
  );

  return { rows: Array.isArray(rows) ? rows : [] };
};

const loadIndexer = async (queryInterface) => {
  const { default: createMetricsIndexer } = await import('../metricsIndexes.js');

  return createMetricsIndexer({
    query: buildQueryRunner(queryInterface),
    log: (message) => console.log(`  ${message}`),
    maintenanceWorkMem: process.env.INDEX_BUILD_MAINTENANCE_WORK_MEM,
  });
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const indexer = await loadIndexer(queryInterface);

    await indexer.create();
  },
  async down(queryInterface) {
    const indexer = await loadIndexer(queryInterface);

    await indexer.drop();
  },
};
