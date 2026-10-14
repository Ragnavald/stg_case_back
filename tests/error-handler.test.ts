import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('error handler', () => {
  it('answers 400 on malformed JSON instead of a 500', async () => {
    const res = await request(app).post('/users').set('Content-Type', 'application/json').send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON body' });
  });
});
