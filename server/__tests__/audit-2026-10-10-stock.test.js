import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest';

// Audit 2026-10-10, F01: tracked stock was checked when quoting and never reduced, so the last unit could be sold
// again and again. A saved order now takes its units from the stock (services/pricing.js takeFromStock).
vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));
const { fakes } = await import('./helpers/fakes.js');
const { freshIp, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { clearAccessTokenCache } = await import('../services/paypalService.js');
const { takeFromStock } = await import('../services/pricing.js');
const { http, close } = startClient(createApp());
afterAll(close);

const post = (path, body) => http.post(path).set('X-Forwarded-For', freshIp()).send(body);
const address = { firstName: 'Mary', lastName: 'Buyer', phone: '123456789', email: 'buyer@example.com', street: 'Street 1', city: 'Nazareth', state: 'North', postal: '16000', country: 'IL' };
const stockOf = (product) => fakes.Product.byId(product._id).stock;

// One whole purchase: quote + PayPal order, PayPal says paid in full, the order is saved.
let nextId = 0;
async function buy(product, quantity) {
  const id = `STOCK${String(++nextId).padStart(12, '0')}`;
  const value = (product.price * quantity * 0.9 + 5).toFixed(2);
  const paid = { id, status: 'COMPLETED', purchase_units: [{ amount: { currency_code: 'USD', value }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value } }] } }] };
  global.fetch = vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('/oauth2/token') ? { access_token: 'test-token' } : String(url).endsWith('/v2/checkout/orders') ? { id, status: 'CREATED' } : paid),
  }));
  const created = await post('/order/create_order', { type: 'order', items: [{ _id: product._id, quantity }] });
  if (created.status !== 200) return { created };
  const saved = await post('/order/newOrder', { ...address, products: [{ productID: product._id, quantity }], paypalOrderId: id });
  return { created, saved, id };
}

beforeEach(() => {
  fakes.Payment.reset();
  fakes.Product.reset();
  fakes.Order.reset();
  clearAccessTokenCache();
});

describe('F01: a saved order takes its units from the stock', () => {
  it('reduces tracked stock by the quantity sold, once, and the next quote sees what is left', async () => {
    const [cross] = fakes.Product.seed([{ name: 'Olive wood cross', price: 10, img: 'x', stock: 3 }]);
    const first = await buy(cross, 2);
    expect(first.saved.status).toBe(201);
    expect(stockOf(cross)).toBe(1);

    // the same payment sent again saves nothing and takes nothing
    const again = await post('/order/newOrder', { ...address, products: [{ productID: cross._id, quantity: 2 }], paypalOrderId: first.id });
    expect(again.status).toBe(409);
    expect(stockOf(cross)).toBe(1);

    // two more are no longer available; the last one is
    expect((await buy(cross, 2)).created.status).toBe(409);
    expect((await buy(cross, 1)).saved.status).toBe(201);
    expect(stockOf(cross)).toBe(0);
    expect((await buy(cross, 1)).created.status).toBe(409);
    expect(fakes.Order.docs).toHaveLength(2);
  });

  it('leaves a product whose stock is not tracked (null) alone', async () => {
    const [oil] = fakes.Product.seed([{ name: 'Olive oil', price: 10, img: 'x', stock: null }]);
    expect((await buy(oil, 5)).saved.status).toBe(201);
    expect(stockOf(oil)).toBeNull();
  });

  it('never goes below zero: a paid order for more than is left is saved, the stock becomes 0 and the oversale is logged', async () => {
    const [cross] = fakes.Product.seed([{ name: 'Olive wood cross', price: 10, img: 'x', stock: 2 }]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const id = 'STOCKRACE00000001';
    const paid = { id, status: 'COMPLETED', purchase_units: [{ amount: { currency_code: 'USD', value: '23.00' }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value: '23.00' } }] } }] };
    global.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('/oauth2/token') ? { access_token: 'test-token' } : String(url).endsWith('/v2/checkout/orders') ? { id, status: 'CREATED' } : paid) }));
    expect((await post('/order/create_order', { type: 'order', items: [{ _id: cross._id, quantity: 2 }] })).status).toBe(200);
    // another customer's order took one unit between this customer's quote and payment
    fakes.Product.byId(cross._id).stock = 1;
    const saved = await post('/order/newOrder', { ...address, products: [{ productID: cross._id, quantity: 2 }], paypalOrderId: id });
    expect(saved.status).toBe(201); // the money has moved: the order is kept for the owner to settle
    expect(stockOf(cross)).toBe(0);
    expect(errors.mock.calls.flat().join(' ')).toMatch(/\[oversold\].*1 more of "Olive wood cross"/);
    errors.mockRestore();
  });

  it('takeFromStock adds up lines of the same product and ignores what is not an order line', async () => {
    const [cross, oil] = fakes.Product.seed([
      { name: 'Olive wood cross', price: 10, img: 'x', stock: 10 },
      { name: 'Olive oil', price: 10, img: 'x', stock: null },
    ]);
    const result = await takeFromStock([
      { productID: String(cross._id), quantity: 2, color: 'brown' },
      { productID: String(cross._id), quantity: 3, color: 'green' },
      { productID: String(oil._id), quantity: 4 },
      { productID: 'not-an-id', quantity: 1 },
      { productID: String(cross._id), quantity: -5 },
      null,
    ]);
    expect(result).toEqual({ changed: 1, oversold: [] });
    expect(stockOf(cross)).toBe(5);
    expect(stockOf(oil)).toBeNull();
    expect(await takeFromStock(undefined)).toEqual({ changed: 0, oversold: [] });
  });

  // Review of 2026-10-11.
  it('a restock between the failed take and the fallback is not overwritten with 0', async () => {
    const [cross] = fakes.Product.seed([{ name: 'Olive wood cross', price: 10, img: 'x', stock: 1 }]);
    const real = fakes.Product.updateOne.bind(fakes.Product);
    const spy = vi.spyOn(fakes.Product, 'updateOne').mockImplementation(async (filter, update, options) => {
      const result = await real(filter, update, options);
      fakes.Product.byId(cross._id).stock = 50; // the owner restocks right after the first attempt found too few
      return result;
    });
    const result = await takeFromStock([{ productID: String(cross._id), quantity: 2 }]);
    spy.mockRestore();
    expect(result).toEqual({ changed: 0, oversold: [] });
    expect(stockOf(cross)).toBe(50);
  });

  it('a payment made without a stored quote is not refused afterwards for stock or colour: it is saved and logged', async () => {
    const [cross] = fakes.Product.seed([{ name: 'Olive wood cross', price: 10, img: 'x', stock: 0, color: ['brown'] }]);
    const id = 'STOCKLEGACY000001';
    const paid = { id, status: 'COMPLETED', purchase_units: [{ amount: { currency_code: 'USD', value: '14.00' }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value: '14.00' } }] } }] };
    global.fetch = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('/oauth2/token') ? { access_token: 'test-token' } : paid) }));
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    // an older client: no create_order through this API, so no quote is stored; the unit sold out and the colour is gone
    const saved = await post('/order/newOrder', { ...address, products: [{ productID: cross._id, quantity: 1, color: 'green' }], paypalOrderId: id });
    expect(saved.status).toBe(201);
    expect(fakes.Order.docs).toHaveLength(1);
    const logged = warnings.mock.calls.flat().join(' ');
    expect(logged).toMatch(/order after payment.*1 of Olive wood cross ordered, 0 in stock/);
    expect(logged).toMatch(/colour "green" is not offered/);
    warnings.mockRestore();
    errors.mockRestore();
    // before any payment the same request is still refused
    expect((await post('/order/create_order', { type: 'order', items: [{ _id: cross._id, quantity: 1, color: 'brown' }] })).status).toBe(409);
  });

  it('compares colours with HTML entities decoded on both sides', async () => {
    const { quoteShopOrder } = await import('../services/pricing.js');
    const [mix] = fakes.Product.seed([{ name: 'Set', price: 10, img: 'x', stock: null, color: ['Black & gold', 'Red &amp; white'] }]);
    await expect(quoteShopOrder([{ _id: String(mix._id), quantity: 1, color: 'Black &amp; gold' }])).resolves.toMatchObject({ total: 14, warnings: [] });
    await expect(quoteShopOrder([{ _id: String(mix._id), quantity: 1, color: 'Red &amp; white' }])).resolves.toMatchObject({ total: 14 });
    await expect(quoteShopOrder([{ _id: String(mix._id), quantity: 1, color: 'Blue' }])).rejects.toMatchObject({ status: 409 });
  });
});
