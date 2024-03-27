import request from 'supertest'
import { beforeEach, afterEach, describe, it } from '@jest/globals';


describe('GET in /metrics', () => {
    it('Must request metrics', async () => {
        await request('http://localhost:3000').get('/metrics')
        .expect(200);
    })
});