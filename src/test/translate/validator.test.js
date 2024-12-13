import request from 'supertest';
import express from 'express';
import { textValidationRules, idValidationRules, timestampValidationRules, reviewValidationRules, checkValidation } from '../../app/middlewares/validator';
import { VALIDATION_ERRORS } from '../../config/validation.js';

const app = express();
app.use(express.json()); // Para poder lidar com JSON no body

// Rota de exemplo para testar a validação de texto
app.post('/test-text', textValidationRules, checkValidation, (req, res) => {
  res.status(200).send('Texto válido');
});

// Rota de exemplo para testar a validação do ID (UUID)
app.get('/test-id/:requestUID', idValidationRules, checkValidation, (req, res) => {
  res.status(200).send('ID válido');
});

// Rota de exemplo para testar a validação de timestamp
app.get('/test-timestamp', timestampValidationRules, checkValidation, (req, res) => {
  res.status(200).send('Timestamp válido');
});

// Rota de exemplo para testar a validação de revisão
app.post('/test-review', reviewValidationRules, checkValidation, (req, res) => {
  res.status(200).send('Revisão válida');
});

// Testes

describe('Validação de Requisições', () => {
  it('Deve retornar erro se o campo "text" estiver ausente', async () => {
    const response = await request(app)
      .post('/test-text')
      .send({});

    expect(response.status).toBe(422);
    expect(response.body.errors.find(e => e.param === 'text').msg).toBe(VALIDATION_ERRORS.notFoundText);
  });

  it('Deve retornar erro se o campo "text" for muito curto', async () => {
    const response = await request(app)
      .post('/test-text')
      .send({ text: 'A' });

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveLength(1); // Espera 1 erro
    expect(response.body.errors[0].text).toBe(VALIDATION_ERRORS.textLength); // Verifica a mensagem de erro
  });

  it('Deve retornar erro se o UUID não for válido', async () => {
    const response = await request(app)
      .get('/test-id/invalid-uuid')
      .send();

    expect(response.status).toBe(422);
    expect(response.body.errors.find(e => e.param === 'requestUID').msg).toBe(VALIDATION_ERRORS.uuidVersion);
  });

  it('Deve retornar erro se o "startTime" for inválido', async () => {
    const response = await request(app)
      .get('/test-timestamp?startTime=invalid')
      .send();

    expect(response.status).toBe(422);
    expect(response.body.errors.find(e => e.param === 'startTime').msg).toBe(VALIDATION_ERRORS.dateInterval);
  });

  it('Deve retornar erro se a "rating" não estiver dentro das opções válidas', async () => {
    const response = await request(app)
      .post('/test-review')
      .send({ text: 'Good translation', translation: 'Boa tradução', rating: 999 });

    expect(response.status).toBe(422);
    expect(response.body.errors.find(e => e.param === 'rating').msg).toBe(VALIDATION_ERRORS.ratingOptions);
  });

  it('Deve retornar sucesso quando os dados forem válidos', async () => {
    const response = await request(app)
      .post('/test-review')
      .send({ text: 'Good translation', translation: 'Boa tradução', rating: 5 });

    expect(response.status).toBe(200);
    expect(response.text).toBe('Revisão válida');
  });
});
