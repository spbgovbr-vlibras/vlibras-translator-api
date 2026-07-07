import {
  describe, expect, it, jest,
} from '@jest/globals';

import {
  createGlossRefinementEnabledMiddleware,
  createGlossRefinementService,
  shouldUseGlossRefinementMode,
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

describe('Gloss refinement mode selection', () => {
  it('should always allow live mode', () => {
    expect(shouldUseGlossRefinementMode({ NODE_ENV: 'production' }, 'live')).toBe(true);
  });

  it('should reject stub mode in production by default', () => {
    expect(shouldUseGlossRefinementMode({ NODE_ENV: 'production' }, 'stub')).toBe(false);
  });

  it('should allow stub mode outside production', () => {
    expect(shouldUseGlossRefinementMode({ NODE_ENV: 'dev' }, 'stub')).toBe(true);
  });

  it('should allow stub mode in production when explicitly enabled', () => {
    expect(shouldUseGlossRefinementMode({
      GLOSS_REFINEMENT_ALLOW_STUB: 'true',
      NODE_ENV: 'production',
    }, 'stub')).toBe(true);
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

  it('should return the base gloss when capabilities disable refinement', async () => {
    const requestReply = jest.fn()
      .mockResolvedValueOnce({
        gloss_refinement: {
          enabled: false,
          mode: 'live',
          queue: 'refine.gloss',
        },
      });
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'true',
        GLOSS_REFINEMENT_QUEUE: 'refine.gloss',
        NODE_ENV: 'production',
        WORKER_CAPABILITIES_QUEUE: 'worker.capabilities',
      },
    });

    const refinedGloss = await service.refineGloss({
      gloss: 'BASE GLOSS',
      text: 'bom dia',
      uid: 'uid-2',
    });

    expect(refinedGloss).toBe('BASE GLOSS');
    expect(requestReply).toHaveBeenCalledTimes(1);
  });

  it('should send text and gloss to the refinement queue and return the refined translation', async () => {
    const requestReply = jest.fn()
      .mockResolvedValueOnce({
        gloss_refinement: {
          enabled: true,
          mode: 'live',
          queue: 'refine.custom',
        },
      })
      .mockResolvedValueOnce({
        translation: 'GLOSSA REFINADA',
      });
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'true',
        GLOSS_REFINEMENT_QUEUE: 'refine.gloss',
        NODE_ENV: 'production',
        WORKER_CAPABILITIES_QUEUE: 'worker.capabilities',
      },
    });

    const refinedGloss = await service.refineGloss({
      gloss: 'GLOSSA BASE',
      text: 'bom dia',
      uid: 'uid-3',
    });

    expect(refinedGloss).toBe('GLOSSA REFINADA');
    expect(requestReply).toHaveBeenNthCalledWith(1, {
      correlationId: 'uid-3:capabilities',
      payload: { type: 'capabilities' },
      queueName: 'worker.capabilities',
    });
    expect(requestReply).toHaveBeenNthCalledWith(2, {
      correlationId: 'uid-3:refine',
      payload: { text: 'bom dia', gloss: 'GLOSSA BASE' },
      queueName: 'refine.custom',
    });
  });

  it('should fall back to the base gloss when refinement fails', async () => {
    const requestReply = jest.fn()
      .mockResolvedValueOnce({
        gloss_refinement: {
          enabled: true,
          mode: 'live',
          queue: 'refine.gloss',
        },
      })
      .mockRejectedValueOnce(new Error('queue timeout'));
    const service = createGlossRefinementService({
      requestReply,
      runtimeEnv: {
        GLOSS_REFINEMENT_ENABLED: 'true',
        GLOSS_REFINEMENT_QUEUE: 'refine.gloss',
        NODE_ENV: 'production',
        WORKER_CAPABILITIES_QUEUE: 'worker.capabilities',
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
