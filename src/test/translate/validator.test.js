import request from 'supertest';
import express from 'express';
import {
  textValidationRules,
  refineValidationRules,
  idValidationRules,
  timestampValidationRules,
  reviewValidationRules,
  checkValidation,
} from '../../app/middlewares/validator.js';

const app = express();
app.use(express.json());

app.post(
  '/validate-text',
  textValidationRules,
  checkValidation,
  (_req, res) => res.status(200).json({ success: true }),
);

app.post(
  '/validate-review',
  reviewValidationRules,
  checkValidation,
  (_req, res) => res.status(200).json({ success: true }),
);

app.post(
  '/validate-refine',
  refineValidationRules,
  checkValidation,
  (_req, res) => res.status(200).json({ success: true }),
);

app.get(
  '/validate-timestamp',
  timestampValidationRules,
  checkValidation,
  (_req, res) => res.status(200).json({ success: true }),
);

app.get(
  '/validate-id/:requestUID',
  idValidationRules,
  checkValidation,
  (_req, res) => res.status(200).json({ success: true }),
);

app.use((err, _req, res, _next) => {
  if (err.errors) {
    res.status(err.status || 500).json({ error: err.errors });
    return;
  }

  res.status(err.status || 500).json({ error: err.message });
});

describe('Validator Middleware', () => {
  it('should validate text field correctly', async () => {
    const response = await request(app)
      .post('/validate-text')
      .send({ text: 'Valid Text' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject non-string text', async () => {
    const response = await request(app)
      .post('/validate-text')
      .send({ text: { $ne: '' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toContainEqual({
      field: 'text',
      message: "'text' must be a string.",
    });
  });

  it('should validate refine requests without gloss', async () => {
    const response = await request(app)
      .post('/validate-refine')
      .send({ text: 'Valid Text' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should validate refine requests with gloss', async () => {
    const response = await request(app)
      .post('/validate-refine')
      .send({ text: 'Valid Text', gloss: 'VALID GLOSS' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject non-string gloss in refine requests', async () => {
    const response = await request(app)
      .post('/validate-refine')
      .send({ text: 'Valid Text', gloss: { $ne: '' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toContainEqual({
      field: 'gloss',
      message: "'gloss' must be a string.",
    });
  });

  it('should validate UUID correctly', async () => {
    const validUUID = '123e4567-e89b-42d3-a456-426614174000';

    const response = await request(app)
      .get(`/validate-id/${validUUID}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject invalid UUID', async () => {
    const response = await request(app)
      .get('/validate-id/invalid-uuid');

    expect(response.status).toBe(422);
    expect(response.body.error).toContainEqual({
      field: 'requestUID',
      message: "'requestUID' must be a UUID version 4.",
    });
  });

  it('should reject review fields with invalid data', async () => {
    const response = await request(app)
      .post('/validate-review')
      .send({
        text: 'T'.repeat(6000),
        translation: 'Valid Translation',
        rating: 10,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.arrayContaining([
        { field: 'text', message: "'text' exceeded 5000 characters limit." },
        { field: 'rating', message: "'rating' is not in valid values [good,bad]." },
      ]),
    );
  });

  it('should reject NoSQL operator objects in review fields', async () => {
    const response = await request(app)
      .post('/validate-review')
      .send({
        text: { $ne: '' },
        translation: { $regex: '.*' },
        rating: 'bad',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(
      expect.arrayContaining([
        { field: 'text', message: "'text' must be a string." },
        { field: 'translation', message: "'translation' must be a string." },
      ]),
    );
  });

  it('should reject non-string review field', async () => {
    const response = await request(app)
      .post('/validate-review')
      .send({
        text: 'valid text',
        translation: 'valid translation',
        rating: 'bad',
        review: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContainEqual({
      field: 'review',
      message: "'review' must be a string.",
    });
  });

  it('should validate timestamp range correctly', async () => {
    const response = await request(app)
      .get('/validate-timestamp?startTime=1620000000&endTime=1620003600');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject invalid timestamp', async () => {
    const response = await request(app)
      .get('/validate-timestamp?startTime=invalid');

    expect(response.status).toBe(422);
    expect(response.body.error).toContainEqual({
      field: 'startTime',
      message: "'timestamp' is not in a valid date range.",
    });
  });
});
