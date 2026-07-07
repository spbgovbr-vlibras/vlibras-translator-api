import env from '../../config/environments/environment.js';
import { requestQueueReply } from './amqpRpc.js';

const DEFAULT_CAPABILITIES_TTL_MS = 30_000;

const parsePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return parsedValue;
};

const isGlossRefinementEnabled = (runtimeEnv) => runtimeEnv.GLOSS_REFINEMENT_ENABLED === 'true';

const shouldUseGlossRefinementMode = (runtimeEnv, mode) => {
  if (mode === 'live') {
    return true;
  }

  if (mode !== 'stub') {
    return false;
  }

  if (runtimeEnv.GLOSS_REFINEMENT_ALLOW_STUB === 'true') {
    return true;
  }

  return runtimeEnv.NODE_ENV !== 'production';
};

const createGlossRefinementService = ({
  runtimeEnv = env,
  requestReply = requestQueueReply,
  now = Date.now,
  logger = console,
} = {}) => {
  let cachedCapabilities;
  let cachedCapabilitiesExpiresAt = 0;

  const invalidateCapabilitiesCache = () => {
    cachedCapabilities = undefined;
    cachedCapabilitiesExpiresAt = 0;
  };

  const getCapabilities = async (uid) => {
    const currentTime = now();

    if (cachedCapabilities && currentTime < cachedCapabilitiesExpiresAt) {
      return cachedCapabilities;
    }

    const capabilities = await requestReply({
      correlationId: `${uid}:capabilities`,
      payload: { type: 'capabilities' },
      queueName: runtimeEnv.WORKER_CAPABILITIES_QUEUE,
    });

    cachedCapabilities = capabilities;
    cachedCapabilitiesExpiresAt = currentTime + parsePositiveInteger(
      runtimeEnv.WORKER_CAPABILITIES_CACHE_TTL_MS,
      DEFAULT_CAPABILITIES_TTL_MS,
    );

    return capabilities;
  };

  const refineGloss = async ({ text, gloss, uid }) => {
    if (!isGlossRefinementEnabled(runtimeEnv)) {
      return gloss;
    }

    if (!runtimeEnv.WORKER_CAPABILITIES_QUEUE || !runtimeEnv.GLOSS_REFINEMENT_QUEUE) {
      logger.warn(`[Refinement][${uid}] - Filas de capabilities/refino não configuradas. Usando glosa base.`);
      return gloss;
    }

    let capabilities;

    try {
      capabilities = await getCapabilities(uid);
    } catch (error) {
      invalidateCapabilitiesCache();
      logger.warn(`[Refinement][${uid}] - Falha ao consultar capabilities: ${error.message}`);
      return gloss;
    }

    const glossRefinement = capabilities?.gloss_refinement;

    if (!glossRefinement?.enabled) {
      return gloss;
    }

    if (!shouldUseGlossRefinementMode(runtimeEnv, glossRefinement.mode)) {
      return gloss;
    }

    try {
      const refinementResponse = await requestReply({
        correlationId: `${uid}:refine`,
        payload: { text, gloss },
        queueName: glossRefinement.queue || runtimeEnv.GLOSS_REFINEMENT_QUEUE,
      });

      if (typeof refinementResponse.translation !== 'string' || refinementResponse.translation.length === 0) {
        return gloss;
      }

      return refinementResponse.translation;
    } catch (error) {
      logger.warn(`[Refinement][${uid}] - Falha ao refinar glosa: ${error.message}`);
      return gloss;
    }
  };

  return {
    invalidateCapabilitiesCache,
    isGlossRefinementEnabled: () => isGlossRefinementEnabled(runtimeEnv),
    refineGloss,
  };
};

const createGlossRefinementEnabledMiddleware = (runtimeEnv) => (req, _res, next) => {
  if (!isGlossRefinementEnabled(runtimeEnv)) {
    next('route');
    return;
  }

  next();
};

const glossRefinementService = createGlossRefinementService();

export {
  createGlossRefinementEnabledMiddleware,
  createGlossRefinementService,
  isGlossRefinementEnabled,
  shouldUseGlossRefinementMode,
  glossRefinementService,
};
