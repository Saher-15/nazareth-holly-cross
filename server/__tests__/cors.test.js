import { describe, it, expect } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../app.js');
const app = createApp();

const origin = (o) => request(app).get('/health').set('Origin', o);

describe('CORS', () => {
  it.each([
    'https://nazarethholycross.com',
    'https://www.nazarethholycross.com',
    'https://nazarethholycross.netlify.app',
    'https://deploy-preview-12--nazarethholycross.netlify.app',
    'https://nazaretholycrossadmin.netlify.app',
    'http://localhost:3000',
  ])('allows %s', async (o) => {
    const res = await origin(o);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(o);
  });

  it.each([
    'https://evil.netlify.app',
    'https://nazarethholycross.netlify.app.evil.com',
    'https://evil-nazarethholycross.com',
  ])('refuses %s', async (o) => {
    const res = await origin(o);
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests without an Origin (server-to-server, curl)', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('public form rate limit', () => {
  it('stops the 11th review submission within 15 minutes', async () => {
    let last;
    for (let i = 0; i < 11; i += 1) {
      last = await request(app).post('/review/addReview').send({});
    }
    expect(last.status).toBe(429);
  });
});
