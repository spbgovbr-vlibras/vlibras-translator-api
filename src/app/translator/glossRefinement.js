import createError from 'http-errors';
import env from '../../config/environments/environment.js';
import { requestQueueReply } from './amqpRpc.js';

const isGlossRefinementEnabled = (runtimeEnv) => runtimeEnv.GLOSS_REFINEMENT_ENABLED === 'true';

const createGlossRefinementService = ({
  runtimeEnv = env,
  requestReply = requestQueueReply,
  logger = console,
} = {}) => {
  const refineGloss = async ({ text, gloss, uid }) => {
    if (!isGlossRefinementEnabled(runtimeEnv)) {
      return gloss;
    }

    if (!runtimeEnv.GLOSS_REFINEMENT_QUEUE) {
      logger.warn(`[Refinement][${uid}] - Fila de refino não configurada. Usando glosa base.`);
      return gloss;
    }

    try {
      const refinementResponse = await requestReply({
        correlationId: `${uid}:refine`,
        payload: { text, gloss },
        queueName: runtimeEnv.GLOSS_REFINEMENT_QUEUE,
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
    isGlossRefinementEnabled: () => isGlossRefinementEnabled(runtimeEnv),
    refineGloss,
  };
};

const createGlossRefinementEnabledMiddleware = (runtimeEnv) => (req, _res, next) => {
  if (!isGlossRefinementEnabled(runtimeEnv)) {
    next(createError(404, 'Refinement route is disabled for this environment'));
    return;
  }

  next();
};

const glossRefinementService = createGlossRefinementService();

export {
  createGlossRefinementEnabledMiddleware,
  createGlossRefinementService,
  isGlossRefinementEnabled,
  glossRefinementService,
};
