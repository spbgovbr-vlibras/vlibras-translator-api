import request from 'supertest';
import express from 'express';
import apiDocRoute from '../../app/doc/apiDocRoute'; // Ajuste o caminho conforme necessário
import fs from 'fs';

// Criar uma aplicação Express para testar as rotas
const app = express();
app.use('/api', apiDocRoute);

describe('API Documentation Route', () => {
  it('should serve the Swagger UI at /api/docs', async () => {
    const response = await request(app).get('/api/docs');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<title>VLibras Docs</title>'); // Verifica o título customizado
  });

  it('should return a 404 for non-existent routes', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.status).toBe(404);
  });

  it('should serve the Swagger UI static files correctly', async () => {
    const response = await request(app).get('/api/docs');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<div id="swagger-ui"></div>'); // Verifica o conteúdo do Swagger UI
  });  

  it('should return the openapi.json file correctly', async () => {
    // Verifica se o arquivo openapi.json está presente e contém o conteúdo correto
    const jsonFilePath = './src/app/doc/openapi.json';
    const jsonContent = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    expect(jsonContent).toBeDefined();
    expect(jsonContent.openapi).toBe('3.0.0'); // Verifique a versão do OpenAPI no seu arquivo
  });
});
