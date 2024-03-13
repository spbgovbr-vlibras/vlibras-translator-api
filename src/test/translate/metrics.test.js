import app from 'vlibras-translator-api/src/app/app.js'
import request from 'supertest'
import { beforeEach, afterEach, describe, it } from '@jest/globals';

let server;

beforeEach(() => {
    const port = 2997;
    server = app.listen(port);
});

afterEach(() => {
    server.close();
});

describe('GET em /metrics', () => {
    it('Deve requisitar metrics', async () => {
        await request(app).get('/metrics')
        .expect(200);
    })
});