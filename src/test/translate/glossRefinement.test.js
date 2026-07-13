import {
  describe, expect, it, jest,
} from '@jest/globals';

import {
  createGlossRefinementEnabledMiddleware,
  createGlossRefinementService,
} from '../../app/translator/glossRefinement.js';

describe('Gloss refinement feature gate', () => {
  it('should skip the route when refinement is disabled', () => {
    const middleware = createGlossRefinementEnabledMiddleware({
      GLOSS_REFINEMENT_ENABLED: 'false',
    });
    const next = jest.fn();

    middleware({}, {}, next);

    expect(next).toHaveBeenCalledWith('route');
  });

  it('should allow the route when refinement is enabled', () => {
    const middleware = createGlossRefinementEnabledMiddleware({
      GLOSS_REFINEMENT_ENABLED: 'true',
    });
    const next = jest.fn();

    middleware({}, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('Gloss refinement service', () => {
  it('should return the base gloss when refinement is disabled', async () => {
    const requestReply = jest.fn();
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'false',
      },
    });

    const refinedGloss = await service.refineGloss({
      gloss: 'BASE GLOSS',
      text: 'bom dia',
      uid: 'uid-1',
    });

    expect(refinedGloss).toBe('BASE GLOSS');
    expect(requestReply).not.toHaveBeenCalled();
  });

  it('should return the base gloss when refinement queue is not configured', async () => {
    const requestReply = jest.fn();
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'true',
      },
      logger: {
        warn: jest.fn(),
      },
    });

    const refinedGloss = await service.refineGloss({
      gloss: 'BASE GLOSS',
      text: 'bom dia',
      uid: 'uid-2',
    });

    expect(refinedGloss).toBe('BASE GLOSS');
    expect(requestReply).not.toHaveBeenCalled();
  });

  it('should send text and gloss to the refinement queue and return the refined translation', async () => {
    const requestReply = jest.fn()
      .mockResolvedValueOnce({
        translation: 'GLOSSA REFINADA',
      });
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'true',
        GLOSS_REFINEMENT_QUEUE: 'refine.gloss',
      },
    });

    const refinedGloss = await service.refineGloss({
      gloss: 'GLOSSA BASE',
      text: 'bom dia',
      uid: 'uid-3',
    });

    expect(refinedGloss).toBe('GLOSSA REFINADA');
    expect(requestReply).toHaveBeenCalledTimes(1);
    expect(requestReply).toHaveBeenNthCalledWith(1, {
      correlationId: 'uid-3:refine',
      payload: { text: 'bom dia', gloss: 'GLOSSA BASE' },
      queueName: 'refine.gloss',
    });
  });

  it('should fall back to the base gloss when refinement fails', async () => {
    const requestReply = jest.fn()
      .mockRejectedValueOnce(new Error('queue timeout'));
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'true',
        GLOSS_REFINEMENT_QUEUE: 'refine.gloss',
      },
      logger: {
        warn: jest.fn(),
      },
    });

    const refinedGloss = await service.refineGloss({
      gloss: 'GLOSSA BASE',
      text: 'bom dia',
      uid: 'uid-4',
    });

    expect(refinedGloss).toBe('GLOSSA BASE');
  });
});
