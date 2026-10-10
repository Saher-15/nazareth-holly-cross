import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest';

// Regression tests for the findings of the 2026-10-10 QA and security audit that were fixed in the server:
// F02 (the saved payment draft is the only source of the recipient), F05 (bcrypt's 72 bytes), F06 (a colour the
// product does not offer). F07 (the review bars count every review) is in catalog.test.js.
vi.mock('../model/product.js', async () => (await import('./helpers/fakes.js')).fakeModule('Product'));
vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
vi.mock('../model/candle.js', async () => (await import('./helpers/fakes.js')).fakeModule('Candle'));
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(async () => true), SENDER: {} }));
const { fakes } = await import('./helpers/fakes.js');
const { freshIp, startClient } = await import('./helpers/admin.js');
const { createApp } = await import('../app.js');
const { clearAccessTokenCache } = await import('../services/paypalService.js');
const { sendMail } = await import('../services/emailService.js');
const { checkPasswordPolicy } = await import('../services/passwordPolicy.js');
const { hashPassword } = await import('../services/adminAuth.js');
const { http, close } = startClient(createApp());
afterAll(close);

const post = (path, body) => http.post(path).set('X-Forwarded-For', freshIp()).send(body);
const PAYPAL_ID = 'AUDIT000000000001';
const address = { firstName: 'Mary', lastName: 'Original', phone: '123456789', email: 'original@example.com', street: 'Original Street 1', city: 'Nazareth', state: 'North', postal: '16000', country: 'IL' };

// PayPal answers: a token, a created order, then the order as paid in full for `value`.
const payPalPaying = (value) => {
  const paid = { id: PAYPAL_ID, status: 'COMPLETED', purchase_units: [{ amount: { currency_code: 'USD', value }, payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: 'USD', value } }] } }] };
  global.fetch = vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('/oauth2/token') ? { access_token: 'test-token' } : String(url).endsWith('/v2/checkout/orders') ? { id: PAYPAL_ID, status: 'CREATED' } : paid),
  }));
};

beforeEach(() => {
  fakes.Payment.reset();
  fakes.Product.reset();
  fakes.Order.reset();
  clearAccessTokenCache();
  sendMail.mockClear();
});

describe('F06: the colour or design must be one the product offers', () => {
  const quote = (items) => {
    payPalPaying('14.00');
    return post('/order/create_order', { type: 'order', items });
  };

  it('refuses a colour the product does not have, and a missing colour when the product has colours', async () => {
    const [cross] = fakes.Product.seed([{ name: 'Olive wood cross', price: 10, img: 'x', stock: null, color: ['brown', 'green'] }]);
    expect((await quote([{ _id: cross._id, quantity: 1, color: 'nonexistent-variant' }])).status).toBe(409);
    expect((await quote([{ _id: cross._id, quantity: 1 }])).status).toBe(409);
    expect((await quote([{ _id: cross._id, quantity: 1, color: '' }])).status).toBe(409);
    expect(fakes.Payment.docs).toHaveLength(0); // nothing was created at PayPal or in the ledger
  });

  it('refuses a colour for a product that has none, and accepts the product without one', async () => {
    const [oil] = fakes.Product.seed([{ name: 'Olive oil', price: 10, img: 'x', stock: null, color: [] }]);
    expect((await quote([{ _id: oil._id, quantity: 1, color: 'brown' }])).status).toBe(409);
    const ok = await quote([{ _id: oil._id, quantity: 1 }]);
    expect(ok.status).toBe(200);
    expect(ok.body.amount).toBe(14);
  });

  it('accepts an offered colour and keeps it in the quote', async () => {
    const [cross] = fakes.Product.seed([{ name: 'Olive wood cross', price: 10, img: 'x', stock: null, color: ['brown', ' green '] }]);
    const ok = await quote([{ _id: cross._id, quantity: 1, color: ' green ' }]);
    expect(ok.status).toBe(200);
    expect(fakes.Payment.docs[0].orderQuote.lines[0].color).toBe('green');
  });
});

describe('F02: the recipient saved with the payment cannot be replaced afterwards', () => {
  it('saves the order with the draft’s name, address and e-mail, whatever /order/newOrder sends', async () => {
    const [oil] = fakes.Product.seed([{ name: 'Olive oil', price: 10, img: 'x', stock: null }]);
    payPalPaying('14.00');
    const items = [{ _id: oil._id, quantity: 1 }];
    const created = await post('/order/create_order', { type: 'order', items, fulfilment: address });
    expect(created.status).toBe(200);

    const replaced = await post('/order/newOrder', {
      ...address,
      lastName: 'Replaced',
      email: 'thief@example.com',
      street: 'Replacement Street 9',
      city: 'Elsewhere',
      products: [{ productID: oil._id, quantity: 1 }],
      paypalOrderId: PAYPAL_ID,
    });
    expect(replaced.status).toBe(201);
    expect(fakes.Order.docs).toHaveLength(1);
    expect(fakes.Order.docs[0]).toMatchObject({ lastName: 'Original', email: 'original@example.com', street: 'Original Street 1', city: 'Nazareth', paymentVerified: true });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toEqual(['original@example.com']);
  });

  it('still takes the details from the request for a payment that has no draft (older clients)', async () => {
    const [oil] = fakes.Product.seed([{ name: 'Olive oil', price: 10, img: 'x', stock: null }]);
    payPalPaying('14.00');
    await post('/order/create_order', { type: 'order', items: [{ _id: oil._id, quantity: 1 }] });
    const result = await post('/order/newOrder', { ...address, products: [{ productID: oil._id, quantity: 1 }], paypalOrderId: PAYPAL_ID });
    expect(result.status).toBe(201);
    expect(fakes.Order.docs[0]).toMatchObject({ lastName: 'Original', street: 'Original Street 1' });
  });
});

describe('F05: a new password must fit in the 72 bytes bcrypt reads', () => {
  const ascii72 = 'Correct-horse-battery-staple-'.padEnd(72, 'x7Q');

  it('accepts 72 bytes and refuses 73, with a reason that can be shown', () => {
    expect(Buffer.byteLength(ascii72)).toBe(72);
    expect(checkPasswordPolicy(ascii72)).toBeNull();
    expect(checkPasswordPolicy(`${ascii72}!`)).toMatch(/at most 72 characters/);
  });

  it('counts bytes, not characters: Hebrew and Arabic letters take two each', () => {
    const hebrew = 'סיסמה ארוכה מאוד '.repeat(3); // 51 characters, 93 bytes
    expect(hebrew.length).toBeLessThan(72);
    expect(Buffer.byteLength(hebrew)).toBeGreaterThan(72);
    expect(checkPasswordPolicy(hebrew)).toMatch(/at most 72 characters/);
    expect(checkPasswordPolicy('סיסמה טובה וארוכה 2026')).toBeNull();
  });

  it('so no two accepted passwords can share a hash (the truncation the audit showed)', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const first = `${ascii72}-suffix-one`;
    const second = `${ascii72}-suffix-two`;
    // bcrypt itself still cannot tell them apart...
    expect(await bcrypt.compare(second, await hashPassword(first))).toBe(true);
    // ...which is why neither can be set as a password any more.
    expect(checkPasswordPolicy(first)).not.toBeNull();
    expect(checkPasswordPolicy(second)).not.toBeNull();
  }, 20000);
});
