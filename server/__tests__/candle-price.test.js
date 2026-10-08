import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
vi.mock('../model/admin.js', async () => (await import('./helpers/fakes.js')).fakeAdminModule());
vi.mock('../model/adminSession.js', async () => (await import('./helpers/fakes.js')).fakeModule('AdminSession'));
vi.mock('../model/auditLog.js', async () => (await import('./helpers/fakes.js')).fakeModule('AuditLog'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));
const { fakes } = await import('./helpers/fakes.js');
const { signedIn, freshIp, startClient } = await import('./helpers/admin.js');
const { signSessionToken } = await import('../services/adminSessions.js');
const { createApp } = await import('../app.js');
const { clearAccessTokenCache } = await import('../services/paypalService.js');
const { resetSettingsCache, getCandlePrice, CANDLE_PRICE_DEFAULT } = await import('../services/siteSettings.js');
const { http, close } = startClient(createApp());
afterAll(close);

const ID = 'CANDLEPRICE000001';
const paypal = (value) => {
  global.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => String(url).includes('/oauth2/token') ? { access_token: 't' }
    : String(url).endsWith('/v2/checkout/orders') ? { id: ID, status: 'CREATED' }
    : { id: ID, status: 'COMPLETED', purchase_units: [{ amount: { currency_code: 'USD', value }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value } }] } }] } }));
};
const candle = { firstName: 'A', lastName: 'B', email: 'a@example.com', prayer: 'For my family' };

beforeEach(() => {
  fakes.SiteSetting.reset(); fakes.Payment.reset(); fakes.Candle.reset(); fakes.Admin.reset(); fakes.AdminSession.reset(); fakes.AuditLog.reset();
  resetSettingsCache(); clearAccessTokenCache();
});

describe('candle price setting', () => {
  it('defaults to $3, and the public price route says so', async () => {
    expect(await getCandlePrice()).toBe(CANDLE_PRICE_DEFAULT);
    const res = await http.get('/candle/price');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ price: 3, currency: 'USD' });
  });

  it('an owner changes it; create_order then charges the new price; the change is audited', async () => {
    const { token } = await signedIn(signSessionToken, { username: 'owner1', role: 'owner' });
    const put = await http.put('/admin/settings/candle-price').set('X-Forwarded-For', freshIp()).set('Authorization', `Bearer ${token}`).send({ price: 5.5 });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ candlePrice: 5.5, updatedBy: 'owner1' });
    expect(fakes.AuditLog.docs.at(-1)).toMatchObject({ action: 'settings.candle_price', meta: { from: 3, to: 5.5 } });
    paypal('5.50');
    const created = await http.post('/order/create_order').set('X-Forwarded-For', freshIp()).send({ type: 'candle' });
    expect(created.body.amount).toBe(5.5);
    expect((await http.get('/candle/price')).body.price).toBe(5.5);
  });

  it.each([['an editor', 'editor'], ['a viewer', 'viewer']])('%s can read but not change it', async (_, role) => {
    const { token } = await signedIn(signSessionToken, { username: 'u1', role });
    expect((await http.get('/admin/settings').set('X-Forwarded-For', freshIp()).set('Authorization', `Bearer ${token}`)).body.candlePrice).toBe(3);
    const put = await http.put('/admin/settings/candle-price').set('X-Forwarded-For', freshIp()).set('Authorization', `Bearer ${token}`).send({ price: 1 });
    expect(put.status).toBe(403);
    expect(await getCandlePrice()).toBe(3);
  });

  it.each([[0.5], [101], [3.333], ['4'], [null]])('refuses the price %s', async (price) => {
    const { token } = await signedIn(signSessionToken, { username: 'owner2', role: 'owner' });
    const put = await http.put('/admin/settings/candle-price').set('X-Forwarded-For', freshIp()).set('Authorization', `Bearer ${token}`).send({ price });
    expect(put.status).toBe(400);
    expect(await getCandlePrice()).toBe(3);
  });

  it('a candle paid at the old price is still lit after the owner raised it', async () => {
    paypal('3.00');
    expect((await http.post('/order/create_order').set('X-Forwarded-For', freshIp()).send({ type: 'candle' })).body.amount).toBe(3);
    const { setCandlePrice } = await import('../services/siteSettings.js');
    await setCandlePrice(7, { name: 'owner' });
    const lit = await http.post('/candle/lightACandle').set('X-Forwarded-For', freshIp()).send({ ...candle, paypalOrderId: ID });
    expect(lit.status).toBe(200);
    expect(fakes.Candle.docs).toHaveLength(1);
  });

  it('a payment for less than the price it was started with is refused', async () => {
    paypal('1.00'); // PayPal says only $1 was captured for a $3 candle
    await http.post('/order/create_order').set('X-Forwarded-For', freshIp()).send({ type: 'candle' });
    const lit = await http.post('/candle/lightACandle').set('X-Forwarded-For', freshIp()).send({ ...candle, paypalOrderId: ID });
    expect(lit.status).toBe(402);
    expect(fakes.Candle.docs).toHaveLength(0);
  });
});
