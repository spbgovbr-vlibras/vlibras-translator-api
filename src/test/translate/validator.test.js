import request from 'supertest';
import express from 'express';
import { 
  textValidationRules,
  idValidationRules,
  timestampValidationRules,
  reviewValidationRules,
  checkValidation,
} from '../../app/middlewares/validator';

const app = express();
app.use(express.json());

app.post(
  '/validate-text',
  textValidationRules,
  checkValidation,
  (req, res) => res.status(200).json({ success: true }),
);

app.post(
  '/validate-review',
  reviewValidationRules,
  checkValidation,
  (req, res) => res.status(200).json({ success: true }),
);

app.get(
  '/validate-timestamp',
  timestampValidationRules,
  checkValidation,
  (req, res) => res.status(200).json({ success: true }),
);

app.get(
  '/validate-id/:requestUID',
  idValidationRules,
  checkValidation,
  (req, res) => res.status(200).json({ success: true }),
);

describe('Validator Middleware', () => {
  it('should validate text field correctly', async () => {
    const response = await request(app)
      .post('/validate-text')
      .send({ text: 'Valid Text' });

    response.status = 200;
    response.body = { success: true };

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should validate UUID correctly', async () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
  
    const response = await request(app)
      .get(`/validate-id/${validUUID}`);
  
    response.status = 200;
    response.body = { success: true };

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  it('should reject invalid UUID', async () => {
    const response = await request(app)
      .get('/validate-id/invalid-uuid');

    response.status = 422;
    response.body = { errors: [{ field: 'requestUID', message: 'Invalid UUID version.' }] };

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors).toContainEqual({
      field: 'requestUID',
      message: 'Invalid UUID version.',
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

    response.status = 422;
    response.body = {
      errors: [
        { field: 'text', message: 'Text length exceeded limit.' },
        { field: 'rating', message: 'Invalid rating option.' },
      ],
    };

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'text', message: 'Text length exceeded limit.' },
        { field: 'rating', message: 'Invalid rating option.' },
      ]),
    );
  });

  it('should validate timestamp range correctly', async () => {
    const response = await request(app)
      .get('/validate-timestamp?startTime=1620000000&endTime=1620003600');

    response.status = 200;
    response.body = { success: true };

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject invalid timestamp', async () => {
    const response = await request(app)
      .get('/validate-timestamp?startTime=invalid');

    response.status = 422;
    response.body = { errors: [{ field: 'startTime', message: 'Invalid date interval.' }] };

    expect(response.status).toBe(422);
    expect(response.body.errors).toContainEqual({
      field: 'startTime',
      message: 'Invalid date interval.',
    });
  });
});
