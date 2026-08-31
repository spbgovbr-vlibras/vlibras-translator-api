import express from 'express';
import request from 'supertest';
import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const reviewStatsRows = [
  { text: 'texto ruim', translation: 'TEXTO RUIM', review: 'ajustar glosa' },
  { text: 'texto bom', translation: 'TEXTO BOM', review: 'boa traducao' },
];

const queryMock = jest.fn();
const dbMock = {
  sequelize: {
    query: queryMock,
  },
  Sequelize: {
    QueryTypes: {
      SELECT: 'SELECT',
    },
  },
};

jest.unstable_mockModule('../../app/db/models/index.js', () => ({
  default: dbMock,
}));

const { default: reviewRoute } = await import('../../app/review/translationReviewRoute.js');

const app = express();
app.use(express.json());
app.use('/', reviewRoute);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message });
});

describe('GET in /review/stats', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue(reviewStatsRows);
  });

  it('keeps the review stats response contract', async () => {
    const response = await request(app)
      .get('/review/stats')
      .expect(200);

    expect(response.body).toEqual({
      reviewRanking: reviewStatsRows,
    });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /INNER JOIN "Translations" AS translations[\s\S]*reviews\."review" IS NOT NULL[\s\S]*translations\."translation" IS NOT NULL[\s\S]*translations\."translation" <> ''[\s\S]*ORDER BY reviews\."createdAt" DESC/,
      ),
      expect.objectContaining({
        replacements: {},
        type: 'SELECT',
      }),
    );
  });

  it('keeps filtering bad reviews as rating false', async () => {
    await request(app)
      .get('/review/stats?rating=bad')
      .expect(200);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND reviews."rating" = :rating'),
      expect.objectContaining({
        replacements: { rating: false },
      }),
    );
  });

  it('keeps filtering good reviews as rating true', async () => {
    await request(app)
      .get('/review/stats?rating=good')
      .expect(200);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('AND reviews."rating" = :rating'),
      expect.objectContaining({
        replacements: { rating: true },
      }),
    );
  });

  it('keeps ignoring unknown rating values', async () => {
    await request(app)
      .get('/review/stats?rating=unknown')
      .expect(200);

    expect(queryMock).toHaveBeenCalledWith(
      expect.not.stringContaining('AND reviews."rating" = :rating'),
      expect.objectContaining({
        replacements: {},
      }),
    );
  });
});
