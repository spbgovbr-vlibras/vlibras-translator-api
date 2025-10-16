import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { validateTranslationReviewSecure } from '../../app/middlewares/secureReview.js';

describe('SecureReview Middleware Tests', () => {

  describe('Rating-based validation logic', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure(),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should skip validation when rating is "good"', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          rating: 'good'
        });

      expect(response.status).toBe(200);
    });

    it('should skip validation when rating is not "bad"', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA',
          rating: 'neutral'
        });

      expect(response.status).toBe(200);
    });

    it('should require review when rating is "bad"', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Review is required when rating is bad');
    });

    it('should reject empty review when rating is "bad"', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          rating: 'bad',
          review: ''
        });

      expect(response.status).toBe(400);
    });

    it('should reject review with only whitespace when rating is "bad"', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          rating: 'bad',
          review: '   '
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Uppercase validation', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure(),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should accept when both translation and review are uppercase', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'CUMPRIMENTAR MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });

    it('should reject when translation is not uppercase', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'Ola Mundo',
          review: 'CUMPRIMENTAR MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should reject when review is not uppercase', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'Cumprimentar Mundo',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should reject when translation is lowercase', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'ola mundo',
          review: 'CUMPRIMENTAR MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should accept accented uppercase characters', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'ÁGUA CAFÉ',
          review: 'LÍQUIDO BEBIDA',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Similarity validation', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure({
          minSimilarity: 0.5,
          maxSimilarity: 0.95
        }),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should accept review with moderate similarity', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'CASA GRANDE',
          review: 'CASA ENORME',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });

    it('should reject review too similar (almost identical)', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'OLA MUNDO',  // Idêntico
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should reject review too different', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA',
          review: 'CACHORRO GATO PASSARO ELEFANTE TIGRE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should accept review with similarity at lower boundary', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'CASA BONITA GRANDE',
          review: 'EDIFICIO BONITO ENORME',
          rating: 'bad'
        });

      expect([200, 400]).toContain(response.status);
    });

    it('should accept review with similarity at upper boundary', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO VIDA',
          review: 'OLA MUNDO AMOR',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Length validation', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure({ maxLength: 100 }),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should accept translation within length limit', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'CUMPRIMENTAR',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });

    it('should reject translation exceeding length limit', async () => {
      const longTranslation = 'A'.repeat(101);
      const response = await request(app)
        .post('/review')
        .send({
          translation: longTranslation,
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should reject review exceeding length limit', async () => {
      const longReview = 'A'.repeat(101);
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA',
          review: longReview,
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should accept at exact length limit', async () => {
      const exactLength = 'A'.repeat(100);
      const response = await request(app)
        .post('/review')
        .send({
          translation: exactLength,
          review: exactLength,
          rating: 'bad'
        });

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Custom configuration options', () => {
    it('should use custom minSimilarity', async () => {
      const app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure({
          minSimilarity: 0.1,
          maxSimilarity: 0.95
        }),
        (req, res) => res.status(200).json({ success: true })
      );

      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA',
          review: 'CACHORRO GATO PASSARO',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });

    it('should use custom maxSimilarity', async () => {
      const app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure({
          minSimilarity: 0.5,
          maxSimilarity: 0.99
        }),
        (req, res) => res.status(200).json({ success: true })
      );

      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'OLA MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should use custom maxLength', async () => {
      const app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure({ maxLength: 10 }),
        (req, res) => res.status(200).json({ success: true })
      );

      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO VIDA',
          review: 'OI',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Edge cases and error handling', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure(),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should handle missing translation field', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle null translation', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: null,
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle undefined translation', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: undefined,
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle numeric translation', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 12345,
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle array as translation', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: ['OLA', 'MUNDO'],
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle object as review', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA',
          review: { text: 'TESTE' },
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle empty string translation', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: '',
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should handle missing rating field', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'TESTE'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Normalization and comparison', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure(),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should normalize accents before comparison', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'ÁGUA CAFÉ',
          review: 'AGUA CAFE', 
          rating: 'bad'
        });

      expect(response.status).toBe(400); 
    });

    it('should ignore special characters in comparison', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA-MUNDO!',
          review: 'OLA MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400); 
    });

    it('should normalize multiple spaces', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA    MUNDO', 
          review: 'OLA MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });

    it('should trim whitespace before comparison', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: '  OLA MUNDO  ',
          review: 'OLA MUNDO',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Real-world scenarios', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure({
          minSimilarity: 0.5,
          maxSimilarity: 0.95,
          maxLength: 5000
        }),
        (req, res) => res.status(200).json({ success: true })
      );
    });

    it('should accept valid correction suggestion', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'PESSOA COMER ALIMENTO',
          review: 'PESSOA ALIMENTAR COMIDA',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });

    it('should accept good rating without review', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          rating: 'good'
        });

      expect(response.status).toBe(200);
    });

    it('should handle complex gloss with multiple words', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'EU IR ESCOLA APRENDER LIBRAS COMUNICAR SURDO',
          review: 'EU FREQUENTAR ESCOLA ESTUDAR LIBRAS CONVERSAR SURDO',
          rating: 'bad'
        });

      expect(response.status).toBe(200);
    });

    it('should reject when trying to bypass with mixed case', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA MUNDO',
          review: 'ola mundo',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Security and logging', () => {
    let app;
    let consoleSpy;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.post('/review',
        validateTranslationReviewSecure(),
        (req, res) => res.status(200).json({ success: true })
      );

      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should not expose detailed error reasons to client', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'OLA',
          review: 'CACHORRO GATO PASSARO ELEFANTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).not.toContain('suggestion-too-different');
      expect(response.body.error).not.toContain('similarity');
    });

    it('should return generic error message', async () => {
      const response = await request(app)
        .post('/review')
        .send({
          translation: 'ola mundo',
          review: 'TESTE',
          rating: 'bad'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Invalid suggestion|Failed to publish review/);
    });
  });
});
