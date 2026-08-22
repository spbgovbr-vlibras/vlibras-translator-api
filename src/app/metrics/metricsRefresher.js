import db from '../db/models/index.js';
import env from '../../config/environments/environment.js';
import { serverInfo, serverError } from '../util/debugger.js';

// As views cobrem apenas dias fechados, então só mudam quando um dia vira.
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REFRESH_LOCK_KEY = 8151974;

const VIEWS = [
  'metrics_translations_daily',
  'metrics_reviews_daily',
  'metrics_hits_top',
];

let timer = null;
let running = false;

// REFRESH CONCURRENTLY exige um refresh anterior.
const isPopulated = async function isPopulated(connection, view) {
  const { rows } = await connection.query(
    'SELECT relispopulated FROM pg_class WHERE relname = $1;',
    [view],
  );

  return Boolean(rows[0]?.relispopulated);
};

const refreshViews = async function refreshViews(connection) {
  for (const view of VIEWS) {
    const startedAt = Date.now();
    const concurrently = await isPopulated(connection, view) ? 'CONCURRENTLY ' : '';

    // Um REFRESH por autocommit: o primeiro, não-concorrente, toma ACCESS
    // EXCLUSIVE e precisa soltá-lo ao terminar, e não no fim do ciclo.
    await connection.query(`REFRESH MATERIALIZED VIEW ${concurrently}${view};`);
    serverInfo(`Metrics view ${view} refreshed in ${Date.now() - startedAt}ms`);
  }
};

const releaseLock = async function releaseLock(connection) {
  try {
    await connection.query('SELECT pg_advisory_unlock($1::bigint);', [REFRESH_LOCK_KEY]);
  } catch (error) {
    // A sessão caiu antes do unlock; o servidor solta o lock junto com ela.
    serverError(`Failed releasing metrics refresh lock: ${error.message}`);
  }
};

/**
 * Atualiza as views materializadas de métricas, sob advisory lock para não
 * duplicar o trabalho entre instâncias. Falhas são registradas e não derrubam
 * o processo: o endpoint segue com os dados do último refresh.
 *
 * @param {import('sequelize').Sequelize} sequelize - Conexão a usar.
 * @returns {Promise<boolean>} Se este processo executou o refresh.
 */
export const refreshMetricsViews = async function refreshMetricsViews(sequelize = db.sequelize) {
  if (running) {
    return false;
  }
  running = true;

  let connection = null;

  try {
    // Lock, REFRESH e unlock têm de sair na mesma conexão: pg_try_advisory_lock
    // é de sessão, e o pool entregaria uma conexão diferente a cada query — o
    // unlock cairia noutra sessão, devolveria false sem lançar erro e deixaria
    // o lock preso, pulando todo refresh seguinte.
    connection = await sequelize.connectionManager.getConnection();

    const { rows } = await connection.query(
      'SELECT pg_try_advisory_lock($1::bigint) AS acquired;',
      [REFRESH_LOCK_KEY],
    );

    if (!rows[0].acquired) {
      serverInfo('Metrics refresh skipped: another instance holds the lock');
      return false;
    }

    try {
      await refreshViews(connection);
      return true;
    } finally {
      await releaseLock(connection);
    }
  } catch (error) {
    serverError(`Failed refreshing metrics views: ${error.message}`);
    return false;
  } finally {
    if (connection) {
      await sequelize.connectionManager.releaseConnection(connection);
    }
    running = false;
  }
};

/**
 * Agenda o refresh periódico, contado a partir do boot. Para fixar a janela,
 * use METRICS_REFRESH_INTERVAL_MS = 0 e dispare refreshMetricsViews por fora.
 *
 * @param {object} runtimeEnv - Variáveis de ambiente.
 * @param {import('sequelize').Sequelize} sequelize - Conexão a usar.
 * @returns {?NodeJS.Timeout} O timer criado, ou null se desligado.
 */
export const startMetricsRefresher = function startMetricsRefresher(
  runtimeEnv = env,
  sequelize = db.sequelize,
) {
  const configured = runtimeEnv.METRICS_REFRESH_INTERVAL_MS ?? DEFAULT_INTERVAL_MS;
  const interval = Number.parseInt(configured, 10);

  if (!Number.isFinite(interval) || interval <= 0) {
    serverInfo('Metrics refresher disabled');
    return null;
  }

  // Até o primeiro refresh terminar, /metrics responde pelo caminho legado.
  refreshMetricsViews(sequelize);

  timer = setInterval(() => refreshMetricsViews(sequelize), interval);
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
