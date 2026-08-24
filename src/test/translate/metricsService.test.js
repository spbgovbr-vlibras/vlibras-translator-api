import { Op } from 'sequelize';
import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

import {
  createMetricsService,
  buildPeriodFilter,
  resolveStatementTimeout,
} from '../../app/metrics/metrics.js';

const createModelsStub = (overrides = {}) => {
  const transactions = [];
  const statements = [];

  const sequelize = {
    transaction: jest.fn().mockImplementation(async (callback) => {
      const transaction = { id: transactions.length };

      transactions.push(transaction);

      return callback(transaction);
    }),
    query: jest.fn().mockImplementation(async (statement, options) => {
      statements.push({ statement, options });
    }),
    fn: jest.fn().mockImplementation((name, column) => ({ fn: name, column })),
    col: jest.fn().mockImplementation((name) => ({ col: name })),
  };

  const models = {
    sequelize,
    Sequelize: { Op },
    Translation: { count: jest.fn().mockResolvedValue(overrides.translations ?? 0) },
    Review: {
      count: jest.fn().mockResolvedValue(overrides.reviews ?? 0),
      findAll: jest.fn().mockResolvedValue(overrides.ratings ?? []),
    },
    Hit: { findAll: jest.fn().mockResolvedValue(overrides.hits ?? []) },
  };

  return { models, transactions, statements };
};

describe('Metrics period filter', () => {
  it('should not filter by createdAt when no window is informed', () => {
    expect(buildPeriodFilter({}, Op)).toEqual({});
  });

  it('should filter only the lower bound when startTime is informed', () => {
    const filter = buildPeriodFilter({ startTime: 1700000000000 }, Op);

    expect(filter.createdAt[Op.gte]).toEqual(new Date(1700000000000));
    expect(filter.createdAt[Op.lte]).toBeUndefined();
  });

  it('should filter only the upper bound when endTime is informed', () => {
    const filter = buildPeriodFilter({ endTime: 1700000000000 }, Op);

    expect(filter.createdAt[Op.lte]).toEqual(new Date(1700000000000));
    expect(filter.createdAt[Op.gte]).toBeUndefined();
  });

  it('should keep the epoch lower bound when startTime is zero', () => {
    const filter = buildPeriodFilter({ startTime: 0 }, Op);

    expect(filter.createdAt[Op.gte]).toEqual(new Date(0));
  });

  it('should filter both bounds when the full window is informed', () => {
    const filter = buildPeriodFilter({ startTime: 100, endTime: 200 }, Op);

    expect(filter.createdAt[Op.gte]).toEqual(new Date(100));
    expect(filter.createdAt[Op.lte]).toEqual(new Date(200));
  });
});

describe('Metrics statement timeout', () => {
  it('should use the informed timeout when it is a valid integer', () => {
    expect(resolveStatementTimeout('5000', 25000)).toBe(5000);
  });

  it('should accept zero to disable the server side timeout', () => {
    expect(resolveStatementTimeout('0', 25000)).toBe(0);
  });

  it('should fall back when the value is missing, negative or not a number', () => {
    expect(resolveStatementTimeout(undefined, 25000)).toBe(25000);
    expect(resolveStatementTimeout('-1', 25000)).toBe(25000);
    expect(resolveStatementTimeout('abc', 25000)).toBe(25000);
  });
});

describe('Metrics collection', () => {
  let stub;

  beforeEach(() => {
    stub = createModelsStub({
      translations: 66000000,
      reviews: 42,
      ratings: [{ rating: true, count: '30' }, { rating: false, count: '12' }],
      hits: [{ _id: 'bom dia', hits: '900' }],
    });
  });

  it('should bound every query with a server side statement timeout', async () => {
    const service = createMetricsService({ models: stub.models, statementTimeout: 25000 });

    await service.collect({});

    expect(stub.statements).toHaveLength(4);
    stub.statements.forEach((entry) => {
      expect(entry.statement).toBe('SET LOCAL statement_timeout = 25000');
      expect(entry.options.transaction).toBeDefined();
    });
  });

  it('should isolate each aggregation in its own short transaction', async () => {
    const service = createMetricsService({ models: stub.models, statementTimeout: 25000 });

    await service.collect({});

    expect(stub.models.sequelize.transaction).toHaveBeenCalledTimes(4);
    expect(new Set(stub.transactions.map((entry) => entry.id)).size).toBe(4);
  });

  it('should not send a createdAt predicate when no window is informed', async () => {
    const service = createMetricsService({ models: stub.models });

    await service.collect({});

    expect(stub.models.Translation.count.mock.calls[0][0].where.createdAt).toBeUndefined();
    expect(stub.models.Review.count.mock.calls[0][0].where.createdAt).toBeUndefined();
    expect(stub.models.Review.findAll.mock.calls[0][0].where).toEqual({});
  });

  it('should send the createdAt predicate when a window is informed', async () => {
    const service = createMetricsService({ models: stub.models });

    await service.collect({ startTime: 100, endTime: 200 });

    const translationWhere = stub.models.Translation.count.mock.calls[0][0].where;

    expect(translationWhere.createdAt[Op.gte]).toEqual(new Date(100));
    expect(translationWhere.createdAt[Op.lte]).toEqual(new Date(200));
    expect(translationWhere.translation).toEqual({ [Op.not]: null });
  });

  it('should never scope the hits ranking by the informed window', async () => {
    const service = createMetricsService({ models: stub.models });

    await service.collect({ startTime: 100, endTime: 200 });

    expect(stub.models.Hit.findAll.mock.calls[0][0].where).toBeUndefined();
    expect(stub.models.Hit.findAll.mock.calls[0][0].limit).toBe(10);
  });

  it('should preserve the response contract', async () => {
    const service = createMetricsService({ models: stub.models });

    await expect(service.collect({})).resolves.toEqual({
      translationsCount: 66000000,
      reviewsCount: 42,
      ratingsCounters: [
        { rating: 'good', count: '30' },
        { rating: 'bad', count: '12' },
      ],
      translationsHits: [{ _id: 'bom dia', hits: '900' }],
    });
  });

  it('should label a null rating as bad', async () => {
    stub = createModelsStub({ ratings: [{ rating: null, count: '3' }] });

    const service = createMetricsService({ models: stub.models });
    const payload = await service.collect({});

    expect(payload.ratingsCounters).toEqual([{ rating: 'bad', count: '3' }]);
  });
});

describe('Metrics handler', () => {
  it('should answer 200 with the aggregated payload', async () => {
    const { models } = createModelsStub({ translations: 7 });
    const service = createMetricsService({ models });
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) };
    const next = jest.fn();

    await service.handler({ query: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ translationsCount: 7 }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should answer 500 when a query is cancelled by the statement timeout', async () => {
    const { models } = createModelsStub();

    models.Translation.count.mockRejectedValue(
      new Error('canceling statement due to statement timeout'),
    );

    const service = createMetricsService({ models });
    const res = { status: jest.fn() };
    const next = jest.fn();

    await service.handler({ query: {} }, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].status).toBe(500);
    expect(next.mock.calls[0][0].message).toBe('Failed to access metrics');
  });
});
