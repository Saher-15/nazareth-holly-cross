import { describe, it, expect, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { applyMongooseSafety } from '../config/mongoose.js';

// The real models and the real query casting, without a database: what would be sent to MongoDB.

const { default: Prayer } = await import('../model/prayer.js');
const { default: Product } = await import('../model/product.js');
const { default: Order } = await import('../model/order.js');

const conditions = (query) => {
  query._castConditions();
  return JSON.parse(JSON.stringify(query._conditions));
};

beforeAll(() => applyMongooseSafety());

describe('Mongoose query safety (backs up express-mongo-sanitize)', () => {
  it('turns an operator used as a value into an equality match', () => {
    expect(conditions(Prayer.find({ category: { $ne: 'Peace' } }))).toEqual({ category: { $eq: { $ne: 'Peace' } } });
    expect(conditions(Order.exists({ paypalOrderId: { $ne: null } }))).toEqual({ paypalOrderId: { $eq: { $ne: null } } });
  });

  it('keeps an operator that the server itself marks as trusted (the order pricing query)', () => {
    const ids = ['64b000000000000000000001'];
    expect(conditions(Product.find({ _id: mongoose.trusted({ $in: ids }) }))).toEqual({ _id: { $in: ids } });
  });

  it('drops filter fields that are not in the schema', () => {
    expect(conditions(Prayer.find({ isAdmin: true, category: 'Peace' }))).toEqual({ category: 'Peace' });
  });
});

describe('models', () => {
  it('a prayer has bounded text', () => {
    const p = new Prayer({ name: 'x'.repeat(201), country: 'PL', prayer: 'y'.repeat(2001) });
    const err = p.validateSync();
    expect(Object.keys(err.errors).sort()).toEqual(['name', 'prayer']);
  });

  it('an order can carry a PayPal order id, and it is not verified by default', () => {
    const o = new Order({ firstName: 'A', lastName: 'B', email: 'a@b.co', totalPrice: 5, products: [] });
    expect(o.paymentVerified).toBe(false);
    expect(o.paypalOrderId).toBeUndefined();
  });

  it('one PayPal order id can be used by only one order (partial unique index)', () => {
    const index = Order.schema.indexes().find(([fields]) => fields.paypalOrderId);
    expect(index[1]).toMatchObject({ unique: true, partialFilterExpression: { paypalOrderId: { $type: 'string' } } });
  });
});
