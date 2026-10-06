import { describe, it, expect, vi, afterEach } from 'vitest';
import mongoose from 'mongoose';

// The database design rules (docs/DATABASE.md) as tests, on the REAL models and without a database: every text field
// is bounded, every query has its index, writes are validated by the schema itself (not only by the routes), the
// production server does not build indexes by itself.

vi.unmock('../model/payment.js');

const models = {
  Admin: (await import('../model/admin.js')).default,
  AdminSession: (await import('../model/adminSession.js')).default,
  AuditLog: (await import('../model/auditLog.js')).default,
  Candle: (await import('../model/candle.js')).default,
  Contact: (await import('../model/contact.js')).default,
  Order: (await import('../model/order.js')).default,
  Payment: (await import('../model/payment.js')).default,
  Prayer: (await import('../model/prayer.js')).default,
  Product: (await import('../model/product.js')).default,
  ProductReview: (await import('../model/productReview.js')).default,
  Review: (await import('../model/review.js')).default,
};
const { PRODUCT_CATEGORIES } = await import('../model/product.js');
const { CATEGORIES } = await import('../services/catalog.js');
const { autoIndexEnabled, applyIndexPolicy } = await import('../config/indexPolicy.js');

const keys = (Model) => Model.schema.indexes().map(([fields]) => Object.entries(fields).map(([f, d]) => `${f}:${d}`).join(','));
const errorsOf = (doc) => Object.keys(doc.validateSync()?.errors ?? {}).sort();

describe('every text field is bounded', () => {
  const unbounded = [];
  for (const [name, Model] of Object.entries(models)) {
    const walk = (schema, prefix = '') => {
      for (const [path, type] of Object.entries(schema.paths)) {
        const limited = (t) => Boolean(t.options?.maxlength || t.options?.enum || (t.validators ?? []).some((v) => v.type === 'maxlength' || v.type === 'enum'));
        if (type.instance === 'String' && !limited(type)) unbounded.push(`${name}.${prefix}${path}`);
        if (type.instance === 'Array' && type.caster?.instance === 'String' && !limited(type.caster)) unbounded.push(`${name}.${prefix}${path}[]`);
        if (type.schema) walk(type.schema, `${prefix}${path}.`);
      }
    };
    walk(Model.schema);
  }

  it('no String field of any model can hold an unlimited amount of text', () => {
    expect(unbounded).toEqual([]);
  });

  it('every number that comes from outside has a minimum or a maximum', () => {
    const open = [];
    for (const [name, Model] of Object.entries(models)) {
      for (const [path, type] of Object.entries(Model.schema.paths)) {
        const bounded = type.options?.min !== undefined || type.options?.max !== undefined;
        if (type.instance === 'Number' && !bounded) open.push(`${name}.${path}`);
      }
    }
    // totpLastStep is a counter the server computes, -1 meaning "none": not input.
    expect(open.filter((p) => p !== 'Admin.totpLastStep' && !p.endsWith('.__v'))).toEqual([]); // __v is Mongoose's own version counter
  });
});

describe('the indexes the queries need', () => {
  // [model, the query it serves, the index it needs]
  const needed = [
    ['Order', 'one PayPal payment pays for one order', 'paypalOrderId:1'],
    ['Order', 'a customer\'s orders, newest first', 'email:1,createdAt:-1'],
    ['Order', 'pending orders first / the dashboard', 'done:1,createdAt:-1'],
    ['Order', 'the default list, CSV export, per-day aggregation', 'createdAt:-1'],
    ['Candle', 'one payment lights one candle', 'paypalOrderId:1'],
    ['Candle', 'pending candle requests', 'done:1,createdAt:-1'],
    ['Candle', 'the default list', 'createdAt:-1'],
    ['Candle', 'a data request by e-mail', 'email:1'],
    ['Contact', 'open messages', 'done:1,createdAt:-1'],
    ['Contact', 'the default list', 'createdAt:-1'],
    ['Contact', 'a data request by e-mail', 'email:1'],
    ['Review', 'the public list (approved, newest first)', 'approved:1,createdAt:-1'],
    ['Review', 'the default admin list', 'createdAt:-1'],
    ['Review', 'a data request by e-mail', 'email:1'],
    ['Prayer', 'the prayer wall, newest first', 'createdAt:-1'],
    ['Prayer', 'the wall by category', 'category:1,createdAt:-1'],
    ['Product', 'site search', 'name:text,description:text'],
    ['Product', 'sort by price', 'price:1'],
    ['Product', 'category pages', 'category:1,price:1'],
    ['Product', 'featured first with a stable paging order', 'rate:-1,_id:1'],
    ['Product', 'newest first (admin, legacy list)', 'createdAt:-1'],
    ['Product', 'low / out of stock', 'stock:1'],
    ['ProductReview', 'a product page: its approved reviews, newest first', 'product:1,approved:1,createdAt:-1'],
    ['ProductReview', 'moderation list and the rating aggregation', 'approved:1,createdAt:-1'],
    ['ProductReview', 'the default admin list', 'createdAt:-1'],
    ['Payment', 'one ledger row per PayPal order', 'paypalOrderId:1'],
    ['Payment', 'the Payments page by status', 'status:1,createdAt:-1'],
    ['Payment', 'the Payments page by type', 'type:1,createdAt:-1'],
    ['Payment', 'the default Payments list and export', 'createdAt:-1'],
    ['Payment', 'from an order / candle to its payment', 'linkedTo.id:1'],
    ['Payment', 'a data request by payer e-mail', 'payerEmail:1'],
    ['Admin', 'sign in by username', 'username:1'],
    ['AdminSession', 'a token is good while its session exists', 'sid:1'],
    ['AdminSession', 'sessions of an account', 'admin:1'],
    ['AdminSession', 'expired sessions are removed (TTL)', 'expiresAt:1'],
    ['AuditLog', 'the audit screen, newest first', 'at:-1'],
    ['AuditLog', 'by actor', 'actorName:1,at:-1'],
    ['AuditLog', 'by action', 'action:1,at:-1'],
  ];

  it.each(needed)('%s: %s -> %s', (model, _query, key) => {
    expect(keys(models[model])).toContain(key);
  });

  it('the unique indexes are where duplicates would be harmful', () => {
    const unique = (Model) => Model.schema.indexes().filter(([, o]) => o.unique).map(([f]) => Object.keys(f).join(','));
    expect(unique(models.Payment)).toEqual(['paypalOrderId']);
    expect(unique(models.Order)).toEqual(['paypalOrderId']);
    expect(unique(models.Candle)).toEqual(['paypalOrderId']);
    expect(unique(models.Admin)).toEqual(['username']);
    expect(unique(models.AdminSession)).toEqual(['sid']);
    // orders and candles are saved without a PayPal id by older clients: the index only covers documents that have one
    for (const name of ['Order', 'Candle']) {
      const [, options] = models[name].schema.indexes().find(([f]) => f.paypalOrderId);
      expect(options.partialFilterExpression).toEqual({ paypalOrderId: { $type: 'string' } });
    }
  });

  it('the TTL indexes that expire data are there: audit entries 180 days, sessions at their own expiry', () => {
    const ttl = (Model) => Model.schema.indexes().filter(([, o]) => o.expireAfterSeconds !== undefined).map(([f, o]) => [Object.keys(f)[0], o.expireAfterSeconds]);
    expect(ttl(models.AuditLog)).toEqual([['at', 180 * 24 * 3600]]);
    expect(ttl(models.AdminSession)).toEqual([['expiresAt', 0]]);
    for (const name of ['Order', 'Candle', 'Contact', 'Payment']) expect(ttl(models[name])).toEqual([]); // customer records never expire by themselves
  });

  it('there is no index that no query uses (every declared index appears in the list above or is a TTL / unique one)', () => {
    const listed = new Set(needed.map(([m, , k]) => `${m}|${k}`));
    const extra = [];
    for (const [name, Model] of Object.entries(models)) {
      for (const [fields, options] of Model.schema.indexes()) {
        const key = Object.entries(fields).map(([f, d]) => `${f}:${d}`).join(',');
        if (!listed.has(`${name}|${key}`) && !options.unique && options.expireAfterSeconds === undefined) extra.push(`${name}|${key}`);
      }
    }
    expect(extra).toEqual([]);
  });
});

describe('writes are validated by the schema itself', () => {
  const order = (over = {}) => ({
    firstName: 'A', lastName: 'B', phone: '1', email: 'a@b.co', street: 's', city: 'c', state: 'x', postal: '1', country: 'IL',
    totalPrice: 10, products: [{ productID: new mongoose.Types.ObjectId(), productName: 'x', quantity: 1 }], ...over,
  });

  it('an order is complete: name, contact, address, a price and 1 to 100 lines', () => {
    expect(errorsOf(new models.Order(order()))).toEqual([]);
    for (const field of ['firstName', 'lastName', 'phone', 'email', 'street', 'city', 'state', 'postal', 'country', 'totalPrice']) {
      expect(errorsOf(new models.Order(order({ [field]: undefined }))), field).toContain(field);
    }
    expect(errorsOf(new models.Order(order({ products: [] })))).toEqual(['products']);
    const line = { productID: new mongoose.Types.ObjectId(), productName: 'x', quantity: 1 };
    expect(errorsOf(new models.Order(order({ products: Array.from({ length: 101 }, () => line) })))).toEqual(['products']);
  });

  it('an order line needs a product id and a whole quantity from 1 to 50', () => {
    const bad = (line) => errorsOf(new models.Order(order({ products: [line] })));
    const id = new mongoose.Types.ObjectId();
    expect(bad({ productName: 'x', quantity: 1 })).toEqual(['products.0.productID']);
    expect(bad({ productID: id, productName: 'x' })).toEqual(['products.0.quantity']);
    expect(bad({ productID: id, quantity: 0 })).toEqual(['products.0.quantity']);
    expect(bad({ productID: id, quantity: 51 })).toEqual(['products.0.quantity']);
    expect(bad({ productID: id, quantity: 1.5 })).toEqual(['products.0.quantity']);
    expect(bad({ productID: id, quantity: 2, productName: 'y'.repeat(201) })).toEqual(['products.0.productName']);
  });

  it('an order total is positive and bounded; text fields are limited', () => {
    expect(errorsOf(new models.Order(order({ totalPrice: 0 })))).toEqual(['totalPrice']);
    expect(errorsOf(new models.Order(order({ totalPrice: -5 })))).toEqual(['totalPrice']);
    expect(errorsOf(new models.Order(order({ totalPrice: 2_000_000 })))).toEqual(['totalPrice']);
    expect(errorsOf(new models.Order(order({ street: 'x'.repeat(201), postal: 'y'.repeat(21) })))).toEqual(['postal', 'street']);
  });

  it('e-mail addresses are checked and stored in lower case (orders, candle requests)', () => {
    expect(errorsOf(new models.Order(order({ email: 'nope' })))).toEqual(['email']);
    expect(new models.Order(order({ email: 'Anna@Example.COM' })).email).toBe('anna@example.com');
    const candle = (over) => new models.Candle({ firstName: 'A', lastName: 'B', email: 'a@b.co', prayer: 'Peace be with you', ...over });
    expect(errorsOf(candle({ email: 'nope' }))).toEqual(['email']);
    expect(errorsOf(candle({ prayer: 'no' }))).toEqual(['prayer']);
    expect(errorsOf(candle({ email: `${'a'.repeat(250)}@b.co` }))).toContain('email');
  });

  it('contact and review e-mail addresses are checked too (a review may have none)', () => {
    expect(errorsOf(new models.Contact({ fullName: 'Visitor', email: 'nope', msg: 'Hello' }))).toEqual(['email']);
    expect(errorsOf(new models.Contact({ fullName: 'Visitor', email: 'a@b.co', msg: 'Hello' }))).toEqual([]);
    expect(errorsOf(new models.Review({ fullName: 'Visitor', msg: 'Lovely' }))).toEqual([]);
    expect(errorsOf(new models.Review({ fullName: 'Visitor', email: 'nope', msg: 'Lovely' }))).toEqual(['email']);
  });

  it('a product: bounded name, price, stock (a whole number or null), colours, images and category', () => {
    const product = (over = {}) => new models.Product({ name: 'Cross', price: 5, img: 'https://example.com/a.jpg', ...over });
    expect(errorsOf(product())).toEqual([]);
    expect(errorsOf(product({ stock: -1 }))).toEqual(['stock']);
    expect(errorsOf(product({ stock: 2.5 }))).toEqual(['stock']);
    expect(errorsOf(product({ stock: null }))).toEqual([]);
    expect(errorsOf(product({ stock: 7 }))).toEqual([]);
    expect(errorsOf(product({ price: 0 }))).toEqual(['price']);
    expect(errorsOf(product({ price: 10001 }))).toEqual(['price']);
    expect(errorsOf(product({ img: 'https://e.com/' + 'a'.repeat(2100) }))).toEqual(['img']);
    expect(errorsOf(product({ additionalImageUrls: Array.from({ length: 21 }, () => 'https://example.com/b.jpg') }))).toEqual(['additionalImageUrls']);
    expect(errorsOf(product({ color: Array.from({ length: 21 }, () => 'red') }))).toEqual(['color']);
    expect(errorsOf(product({ color: ['x'.repeat(51)] }))).toEqual(['color.0']);
    expect(errorsOf(product({ uuidv4_: 'x'.repeat(65) }))).toEqual(['uuidv4_']);
  });

  it('a product category is one of the storefront categories, or null (= taken from the name)', () => {
    const product = (category) => new models.Product({ name: 'Cross', price: 5, img: 'https://example.com/a.jpg', category });
    for (const category of PRODUCT_CATEGORIES) expect(errorsOf(product(category))).toEqual([]);
    expect(errorsOf(product(null))).toEqual([]);
    expect(errorsOf(product(undefined))).toEqual([]);
    expect(errorsOf(product('toys'))).toEqual(['category']);
  });

  it('the category list of the model and the one the storefront uses are the same', () => {
    expect([...PRODUCT_CATEGORIES]).toEqual([...CATEGORIES]);
  });

  it('a payment: a known type and status, a bounded amount, no negative money', () => {
    const payment = (over = {}) => new models.Payment({ paypalOrderId: 'ABCDEFGHIJ0123456', type: 'order', amount: 23, ...over });
    expect(errorsOf(payment())).toEqual([]);
    expect(payment().status).toBe('created');
    expect(payment().currency).toBe('USD');
    expect(errorsOf(payment({ type: 'gift' }))).toEqual(['type']);
    expect(errorsOf(payment({ status: 'refunded' }))).toEqual(['status']);
    expect(errorsOf(payment({ amount: -1 }))).toEqual(['amount']);
    expect(errorsOf(payment({ paypalOrderId: undefined }))).toEqual(['paypalOrderId']);
    expect(errorsOf(payment({ paypalOrderId: 'short' }))).toEqual(['paypalOrderId']);
    expect(errorsOf(payment({ notes: 'x'.repeat(1001) }))).toEqual(['notes']);
    expect(errorsOf(payment({ linkedTo: { kind: 'review', id: new mongoose.Types.ObjectId() } }))).toEqual(['linkedTo.kind']);
    expect(payment({ payerEmail: ' Buyer@Example.com ' }).payerEmail).toBe('buyer@example.com');
  });

  it('a prayer category is one of the six, likes never negative, text bounded', () => {
    const prayer = (over = {}) => new models.Prayer({ name: 'Sofia', country: 'GR', prayer: 'Please pray', ...over });
    expect(errorsOf(prayer())).toEqual([]);
    expect(errorsOf(prayer({ category: 'Gossip' }))).toEqual(['category']);
    expect(errorsOf(prayer({ likes: -1 }))).toEqual(['likes']);
  });

  it('a product review is a whole rating of 1 to 5 on a product', () => {
    const review = (over = {}) => new models.ProductReview({ product: new mongoose.Types.ObjectId(), name: 'Peter', rating: 5, comment: 'Beautiful', ...over });
    expect(errorsOf(review())).toEqual([]);
    expect(errorsOf(review({ rating: 6 }))).toEqual(['rating']);
    expect(errorsOf(review({ rating: 2.5 }))).toEqual(['rating']);
    expect(errorsOf(review({ product: undefined }))).toEqual(['product']);
  });
});

describe('collection names', () => {
  it('are singular, except the two that Mongoose pluralised before explicit names were used (renaming would orphan the data)', () => {
    const names = Object.fromEntries(Object.entries(models).map(([model, Model]) => [model, Model.collection.name]));
    expect(names).toEqual({
      Admin: 'admins', AdminSession: 'adminSession', AuditLog: 'auditLog', Candle: 'candle', Contact: 'contact', Order: 'order', Payment: 'payment',
      Prayer: 'prayers', Product: 'product', ProductReview: 'productReview', Review: 'review',
    });
  });
});

describe('the production server does not build indexes by itself', () => {
  afterEach(() => mongoose.set('autoIndex', true));

  it('autoIndex is on everywhere unless AUTO_INDEX=false (a deploy must not depend on a manual script)', () => {
    expect(autoIndexEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(autoIndexEnabled({ NODE_ENV: 'test' })).toBe(true);
    expect(autoIndexEnabled({})).toBe(true);
    expect(autoIndexEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(autoIndexEnabled({ NODE_ENV: 'production', AUTO_INDEX: 'false' })).toBe(false);
    expect(autoIndexEnabled({ NODE_ENV: 'production', AUTO_INDEX: 'true' })).toBe(true);
  });

  it('applies the policy to Mongoose', () => {
    expect(applyIndexPolicy({ NODE_ENV: 'production', AUTO_INDEX: 'false' })).toBe(false);
    expect(mongoose.get('autoIndex')).toBe(false);
    expect(applyIndexPolicy({ NODE_ENV: 'development' })).toBe(true);
    expect(mongoose.get('autoIndex')).toBe(true);
  });

  it('index.js loads the policy before the app (and so before any model is compiled)', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
    expect(source.indexOf("import './config/indexPolicy.js'")).toBeGreaterThan(-1);
    expect(source.indexOf("import './config/indexPolicy.js'")).toBeLessThan(source.indexOf("from './app.js'"));
  });
});
