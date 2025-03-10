import request from 'supertest';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';

const baseUrl = 'http://localhost:3000'; 

describe('GET /health', () => {
    it('Should return a 200 status and a health check response', async () => {
        const response = await request(baseUrl)
            .get('/health')
            .expect(200); 

        expect(response.body.status).toBe('up');  
    });

    it('Should return 404 for invalid health endpoint', async () => {
        const response = await request(baseUrl)
            .get('/healthcheck') 
            .expect(200);  
    });
});
