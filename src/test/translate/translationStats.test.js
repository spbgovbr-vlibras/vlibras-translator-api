import {
  describe, expect, it, jest,
} from '@jest/globals';

import { createStatsRecorder } from '../../app/translator/translationStats.js';

describe('translationStats', () => {
  it('should schedule stats collection for a translation request', () => {
    const schedule = jest.fn();
    const { scheduleStoreStats, storeStats } = createStatsRecorder({ schedule });
    const req = { body: { text: 'alpha. beta.' } };

    scheduleStoreStats(req);

    expect(schedule).toHaveBeenCalledWith(storeStats, 10, req);
  });

  it('should create and increment hits for each phrase', async () => {
    const existingHit = {
      hits: 2,
      set: jest.fn(),
      save: jest.fn(),
    };
    const builtHit = {
      save: jest.fn(),
    };
    const findOne = jest.fn()
      .mockResolvedValueOnce(existingHit)
      .mockResolvedValueOnce(null);
    const build = jest.fn(() => builtHit);
    const transaction = jest.fn(async (callback) => callback('tx'));

    const { storeStats } = createStatsRecorder({
      database: {
        sequelize: { transaction },
        Hit: { findOne, build },
      },
      splitPhrases: jest.fn().mockResolvedValue(['alpha', 'beta']),
      logger: jest.fn(),
    });

    await storeStats({ body: { text: 'alpha. beta.' } });

    expect(findOne).toHaveBeenNthCalledWith(1, {
      where: { text: 'alpha' },
      transaction: 'tx',
    });
    expect(existingHit.set).toHaveBeenCalledWith({ hits: 3 });
    expect(existingHit.save).toHaveBeenCalledWith({ transaction: 'tx' });
    expect(build).toHaveBeenCalledWith({ text: 'beta', hits: 1 });
    expect(builtHit.save).toHaveBeenCalledWith({ transaction: 'tx' });
  });
});
