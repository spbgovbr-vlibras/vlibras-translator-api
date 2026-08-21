import request from 'supertest'
import { describe, it, expect } from '@jest/globals';

const api = () => request('http://localhost:3000');

// 2026-07-03, dia inteiro em UTC.
const DAY_START = Date.UTC(2026, 6, 3);
const DAY_END = DAY_START + (24 * 60 * 60 * 1000) - 1;

describe('GET in /metrics', () => {
    it('Must request metrics', async () => {
        await api().get('/metrics')
        .expect(200);
    })

    it('Must answer a time range', async () => {
        const { body } = await api()
            .get(`/metrics?startTime=${DAY_START}&endTime=${DAY_END}`)
            .expect(200);

        expect(typeof body.translationsCount).toBe('number');
        expect(typeof body.reviewsCount).toBe('number');
        expect(Array.isArray(body.ratingsCounters)).toBe(true);
        expect(Array.isArray(body.translationsHits)).toBe(true);
    })

    it('Must not discard startTime=0', async () => {
        const [fromEpoch, fromDay] = await Promise.all([
            api().get(`/metrics?startTime=0&endTime=${DAY_END}`).expect(200),
            api().get(`/metrics?startTime=${DAY_START}&endTime=${DAY_END}`).expect(200),
        ]);

        expect(fromEpoch.body.translationsCount)
            .toBeGreaterThanOrEqual(fromDay.body.translationsCount);
    })

    it('Must not read endTime=0 as unbounded', async () => {
        const { body } = await api().get('/metrics?endTime=0').expect(200);

        expect(body.translationsCount).toBe(0);
        expect(body.reviewsCount).toBe(0);
    })

    // Exercita a costura entre os dias vindos da view e as bordas contadas nas
    // tabelas: somar as partes tem de bater com o intervalo inteiro.
    it('Must be consistent when a range is split', async () => {
        const middle = DAY_START + (12 * 60 * 60 * 1000);

        const [whole, first, second] = await Promise.all([
            api().get(`/metrics?startTime=${DAY_START}&endTime=${DAY_END}`).expect(200),
            api().get(`/metrics?startTime=${DAY_START}&endTime=${middle - 1}`).expect(200),
            api().get(`/metrics?startTime=${middle}&endTime=${DAY_END}`).expect(200),
        ]);

        expect(first.body.translationsCount + second.body.translationsCount)
            .toBe(whole.body.translationsCount);
        expect(first.body.reviewsCount + second.body.reviewsCount)
            .toBe(whole.body.reviewsCount);
    })
});
