import { QueryTypes } from 'sequelize';
import db from '../db/models/index.js';
import env from '../../config/environments/environment.js';
import { serverInfo, serverError } from '../util/debugger.js';

// As views cobrem apenas dias fechados, então só mudam quando um dia vira.
// Refresh mais frequente varreria as tabelas sem nada novo para agregar.
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REFRESH_LOCK_KEY = 8151974;

const VIEWS = [
  'metrics_translations_daily',
  'metrics_reviews_daily',
  'metrics_hits_top',
];

let timer = null;
let running = false;

// REFRESH CONCURRENTLY exige um refresh anterior; na primeira vez, com a view
// ainda WITH NO DATA, o refresh precisa ser bloqueante.
const isPopulated = async function isPopulated(view) {
  const [result] = await db.sequelize.query(
    'SELECT relispopulated FROM pg_class WHERE relname = $1;',
    { bind: [view], type: QueryTypes.SELECT },
  );

  return Boolean(result?.relispopulated);
};

/**
 * Atualiza as views materializadas de métricas, sob advisory lock para não
 * duplicar o trabalho entre instâncias. Falhas são registradas e não derrubam
 * o processo: o endpoint segue com os dados do último refresh.
 *
 * @returns {Promise<boolean>} Se este processo executou o refresh.
 */
export const refreshMetricsViews = async function refreshMetricsViews() {
  if (running) {
    return false;
  }
  running = true;

  try {
    const [lock] = await db.sequelize.query(
      'SELECT pg_try_advisory_lock($1) AS acquired;',
      { bind: [REFRESH_LOCK_KEY], type: QueryTypes.SELECT },
    );

    if (!lock.acquired) {
      serverInfo('Metrics refresh skipped: another instance holds the lock');
      return false;
    }

    try {
      for (const view of VIEWS) {
        const startedAt = Date.now();
        const concurrently = await isPopulated(view) ? 'CONCURRENTLY ' : '';

        await db.sequelize.query(`REFRESH MATERIALIZED VIEW ${concurrently}${view};`);
        serverInfo(`Metrics view ${view} refreshed in ${Date.now() - startedAt}ms`);
      }
      return true;
    } finally {
      await db.sequelize.query(
        'SELECT pg_advisory_unlock($1);',
        { bind: [REFRESH_LOCK_KEY], type: QueryTypes.SELECT },
      );
    }
  } catch (error) {
    serverError(`Failed refreshing metrics views: ${error.message}`);
    return false;
  } finally {
    running = false;
  }
};

/**
 * Agenda o refresh periódico, contado a partir do boot. Para fixar a janela
 * (madrugada, por exemplo), use METRICS_REFRESH_INTERVAL_MS = 0 e dispare
 * refreshMetricsViews por fora (cron, job).
 *
 * @returns {?NodeJS.Timeout} O timer criado, ou null se desligado.
 */
export const startMetricsRefresher = function startMetricsRefresher() {
  const interval = Number.parseInt(env.METRICS_REFRESH_INTERVAL_MS ?? DEFAULT_INTERVAL_MS, 10);

  if (!Number.isFinite(interval) || interval <= 0) {
    serverInfo('Metrics refresher disabled');
    return null;
  }

  // Não se espera pelo primeiro refresh: até ele terminar, /metrics responde
  // pelo caminho legado.
  refreshMetricsViews();

  timer = setInterval(refreshMetricsViews, interval);
  timer.unref();
  serverInfo(`Metrics refresher scheduled every ${interval}ms`);

  return timer;
};

export const stopMetricsRefresher = function stopMetricsRefresher() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
