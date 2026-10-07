import { describe, it, expect } from 'vitest';
import request from 'supertest';

const { createApp, DEPLOY_PREVIEW_ORIGIN } = await import('../app.js');
const app = createApp();

const origin = (o) => request(app).get('/health').set('Origin', o);

describe('CORS', () => {
  it.each([
    'https://nazarethholycross.com',
    'https://www.nazarethholycross.com',
    'https://nazarethholycross.netlify.app',
    'https://deploy-preview-12--nazarethholycross.netlify.app',
    'https://deploy-preview-1--nazarethholycross.netlify.app',
    'https://deploy-preview-123456--nazarethholycross.netlify.app',
    'http://localhost:3000',
  ])('allows %s', async (o) => {
    const res = await origin(o);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(o);
  });

  // Security review 06, finding 10: any `<name>--nazarethholycross.netlify.app` used to be trusted (a branch deploy,
  // or a preview built from someone else's fork of the public repository), and so was the retired 2024 admin site.
  it.each([
    'https://evil.netlify.app',
    'https://nazarethholycross.netlify.app.evil.com',
    'https://evil-nazarethholycross.com',
    'https://evil--nazarethholycross.netlify.app',
    'https://main--nazarethholycross.netlify.app',
    'https://feat-x--nazarethholycross.netlify.app',
    'https://deploy-preview--nazarethholycross.netlify.app',
    'https://deploy-preview-12a--nazarethholycross.netlify.app',
    'https://deploy-preview-1234567--nazarethholycross.netlify.app',
    'https://x-deploy-preview-12--nazarethholycross.netlify.app',
    'https://deploy-preview-12--evil--nazarethholycross.netlify.app',
    'https://deploy-preview-12--nazarethholycross.netlify.app.evil.com',
    'http://deploy-preview-12--nazarethholycross.netlify.app',
    'https://deploy-preview-12--nazarethholycross.netlify.app:8443',
    'https://DEPLOY-PREVIEW-12--nazarethholycross.netlify.app',
    'https://nazaretholycrossadmin.netlify.app',
    'https://deploy-preview-3--nazaretholycrossadmin.netlify.app',
    'https://evil--nazaretholycrossadmin.netlify.app',
    'null',
  ])('refuses %s', async (o) => {
    const res = await origin(o);
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('the deploy-preview pattern is anchored at both ends', () => {
    expect(DEPLOY_PREVIEW_ORIGIN.test('https://deploy-preview-7--nazarethholycross.netlify.app')).toBe(true);
    expect(DEPLOY_PREVIEW_ORIGIN.test('https://deploy-preview-7--nazarethholycross.netlify.app/')).toBe(false);
    expect(DEPLOY_PREVIEW_ORIGIN.test(' https://deploy-preview-7--nazarethholycross.netlify.app')).toBe(false);
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
