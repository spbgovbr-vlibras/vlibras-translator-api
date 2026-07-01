import request from 'supertest';
import express from 'express';
import fs from 'fs';
import apiDocRoute from '../../app/doc/apiDocRoute'; // Ajuste o caminho conforme necessário

// Criar uma aplicação Express para testar as rotas
const app = express();
app.use('/api', apiDocRoute);

describe('API Documentation Route', () => {
  it('should serve the Swagger UI at /api/docs', async () => {
    const response = await request(app).get('/api/docs');
    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('docs/');
  });

  it('should return a 404 for non-existent routes', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.status).toBe(404);
  });

  it('should serve the Swagger UI static files correctly', async () => {
    const response = await request(app).get('/api/docs/');
    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(response.text).toContain('<title>VLibras Docs</title>');
    expect(response.text).toContain('<div id="swagger-ui"></div>'); // Verifica o conteúdo do Swagger UI
    expect(response.text).toMatch(/<script nonce="[^"]+">window\.onload/);
  });

  it('should ignore attacker-controlled url query parameters', async () => {
    const response = await request(app).get('/api/docs/swagger-ui-init.js?url=https://attacker.com/malicious_spec.json');

    expect(response.status).toBe(200);
    expect(response.text).toContain('queryConfigEnabled: false');
    expect(response.text).toContain('validatorUrl: null');
    expect(response.text).not.toContain('window.location.search.match(/url=');
    expect(response.text).not.toContain('attacker.com/malicious_spec.json');
  });

  it('should return the openapi.json file correctly', async () => {
    // Verifica se o arquivo openapi.json está presente e contém o conteúdo correto
    const jsonFilePath = './src/app/doc/openapi.json';
    const jsonContent = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    expect(jsonContent).toBeDefined();
    expect(jsonContent.openapi).toBe('3.0.0'); // Verifique a versão do OpenAPI no seu arquivo
  });
});
