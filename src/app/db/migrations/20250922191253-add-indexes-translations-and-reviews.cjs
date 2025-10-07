'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(qi, Sequelize) {
    const mwm = process.env.PG_MAINTENANCE_WORK_MEM || '2GB';
    const pmw = Number(process.env.PG_MAX_PARALLEL_MAINTENANCE_WORKERS || 4);

    await qi.sequelize.query(`SET application_name = 'migrate-add-hash-indexes-up';`);
    await qi.sequelize.query(`SET lock_timeout = '0';`);
    await qi.sequelize.query(`SET statement_timeout = '0';`);
    await qi.sequelize.query(`SET maintenance_work_mem = '${mwm}';`);
    await qi.sequelize.query(`SET max_parallel_maintenance_workers = ${pmw};`);

    await qi.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "translations_translation_text_idx";`
    );

    await qi.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "translations_translation_hash_idx"
       ON "Translations" USING HASH ("translation");`
    );
    await qi.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "translations_text_hash_idx"
       ON "Translations" USING HASH ("text");`
    );

    await qi.sequelize.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "reviews_translation_id_idx"
       ON "Reviews" USING BTREE ("translationId");`
    );

    await qi.sequelize.query(`ANALYZE "Translations";`);
    await qi.sequelize.query(`ANALYZE "Reviews";`);

    await qi.sequelize.query('RESET max_parallel_maintenance_workers;');
    await qi.sequelize.query('RESET maintenance_work_mem;');
    await qi.sequelize.query('RESET lock_timeout;');
    await qi.sequelize.query('RESET statement_timeout;');
    await qi.sequelize.query('RESET application_name;');
  },

  async down(qi, Sequelize) {
    const mwm = process.env.PG_MAINTENANCE_WORK_MEM || '2GB';
    const pmw = Number(process.env.PG_MAX_PARALLEL_MAINTENANCE_WORKERS || 4);

    await qi.sequelize.query(`SET application_name = 'migrate-add-hash-indexes-down';`);
    await qi.sequelize.query(`SET lock_timeout = '0';`);
    await qi.sequelize.query(`SET statement_timeout = '0';`);
    await qi.sequelize.query(`SET maintenance_work_mem = '${mwm}';`);
    await qi.sequelize.query(`SET max_parallel_maintenance_workers = ${pmw};`);

    await qi.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "translations_translation_hash_idx";`
    );
    await qi.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "translations_text_hash_idx";`
    );
    await qi.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "reviews_translation_id_idx";`
    );

    await qi.sequelize.query(`ANALYZE "Translations";`);
    await qi.sequelize.query(`ANALYZE "Reviews";`);

    await qi.sequelize.query('RESET max_parallel_maintenance_workers;');
    await qi.sequelize.query('RESET maintenance_work_mem;');
    await qi.sequelize.query('RESET lock_timeout;');
    await qi.sequelize.query('RESET statement_timeout;');
    await qi.sequelize.query('RESET application_name;');
  },
};
