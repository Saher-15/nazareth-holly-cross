import mongoose from 'mongoose';
import { fakeDb } from '../../test-harness/fake-db.js';

// Sample database content for the operations-script tests (backup, restore, ensure-indexes, check-data,
// reconcile-payments): valid documents of every collection, with real BSON types (ObjectId, Date, numbers).

export const newId = () => new mongoose.Types.ObjectId();
const days = (n) => new Date(Date.now() - n * 86_400_000);
const minutes = (n) => new Date(Date.now() - n * 60_000);

export const ids = {
  cross: newId(), rosary: newId(), order1: newId(), order2: newId(), candle1: newId(), admin: newId(),
};

export const sample = () => ({
  product: [
    { _id: ids.cross, name: 'Olive wood cross', price: 12.5, img: 'https://example.com/cross.jpg', additionalImageUrls: [], color: [], stock: 5, rate: 1, createdAt: days(40), updatedAt: days(40), __v: 0 },
    { _id: ids.rosary, name: 'Rosary', price: 20, img: 'https://example.com/rosary.jpg', additionalImageUrls: ['https://example.com/r2.jpg'], color: ['brown'], stock: null, category: 'rosaries', rate: 2, createdAt: days(30), updatedAt: days(30), __v: 0 },
  ],
  order: [
    {
      _id: ids.order1, firstName: 'Maria', lastName: 'Rossi', phone: '+39 06 1234', email: 'maria@example.com', street: 'Via Roma 1', city: 'Rome', state: 'RM', postal: '00100', country: 'Italy',
      totalPrice: 34.25, products: [{ productID: ids.cross, productName: 'Olive wood cross', quantity: 2, color: '' }], done: false,
      paypalOrderId: 'ORDERPAYPAL000001', paymentVerified: true, createdAt: days(5), updatedAt: days(5), __v: 0,
    },
    {
      _id: ids.order2, firstName: 'John', lastName: 'Smith', phone: '1', email: 'john@example.com', street: 's', city: 'c', state: 'x', postal: '1', country: 'US',
      totalPrice: 23, products: [{ productID: ids.rosary, productName: 'Rosary', quantity: 1 }], done: true, paymentVerified: false, createdAt: days(50), updatedAt: days(49), __v: 0,
    },
  ],
  candle: [
    { _id: ids.candle1, firstName: 'Anna', lastName: 'Lee', email: 'anna@example.com', prayer: 'Peace for all', done: false, paypalOrderId: 'CANDLEPAYPAL00001', paymentVerified: true, createdAt: days(2), updatedAt: days(2), __v: 0 },
  ],
  contact: [{ _id: newId(), fullName: 'Visitor', email: 'visitor@example.com', phone: '1', msg: 'Hello there', done: false, createdAt: days(1), updatedAt: days(1), __v: 0 }],
  review: [{ _id: newId(), fullName: 'Pilgrim', email: '', phone: '000', msg: 'Lovely', approved: true, createdAt: days(3), updatedAt: days(3), __v: 0 }],
  productReview: [{ _id: newId(), product: ids.cross, name: 'Peter', country: 'PL', rating: 5, title: '', comment: 'Beautiful', approved: true, createdAt: days(4), updatedAt: days(4), __v: 0 }],
  prayers: [{ _id: newId(), name: 'Sofia', country: 'GR', prayer: 'Please pray', category: 'Peace', likes: 3, createdAt: days(6), updatedAt: days(6), __v: 0 }],
  admins: [{ _id: ids.admin, username: 'owner', password: '$2a$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghi', role: 'owner', disabled: false, failedLogins: 0, totpEnabled: false, totpLastStep: -1, createdAt: days(90), updatedAt: days(90), __v: 0 }],
  adminSession: [{ _id: newId(), sid: 'sid-1', admin: ids.admin, createdAt: minutes(5), expiresAt: new Date(Date.now() + 3_000_000), revokedAt: null }],
  auditLog: [{ _id: newId(), at: minutes(4), actorName: 'owner', role: 'owner', action: 'auth.login', target: { type: '', id: '' }, meta: {}, ipHash: 'abc', ua: 'Chrome 126 / Windows' }],
  payment: [
    { _id: newId(), paypalOrderId: 'ORDERPAYPAL000001', type: 'order', amount: 34.25, currency: 'USD', status: 'captured', capturedAt: days(5), linkedTo: { kind: 'order', id: ids.order1 }, payerEmail: 'maria@example.com', createdAt: days(5), updatedAt: days(5), __v: 0 },
    { _id: newId(), paypalOrderId: 'CANDLEPAYPAL00001', type: 'candle', amount: 3, currency: 'USD', status: 'captured', capturedAt: days(2), linkedTo: { kind: 'candle', id: ids.candle1 }, createdAt: days(2), updatedAt: days(2), __v: 0 },
    { _id: newId(), paypalOrderId: 'DONATIONPAYPAL001', type: 'donation', amount: 25, currency: 'USD', status: 'captured', capturedAt: days(1), donorName: 'Maria', createdAt: days(1), updatedAt: days(1), __v: 0 },
  ],
});

// A fake database holding `sample()` (or another set of collections).
export function seededDb(data = sample(), name = 'nhc_test') {
  const db = fakeDb({ name });
  for (const [collection, docs] of Object.entries(data)) db.seed(collection, docs);
  return db;
}

// Wraps a fake db and records every method called on a collection, so a test can show a script only read.
export function recorded(db) {
  const calls = [];
  const wrapCollection = (name) => new Proxy(db.collection(name), {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') return value;
      return (...args) => { calls.push(`${name}.${String(prop)}`); return value.apply(target, args); };
    },
  });
  const proxy = new Proxy(db, {
    get(target, prop) {
      if (prop === 'collection') return wrapCollection;
      const value = target[prop];
      if (typeof value !== 'function') return value;
      return (...args) => { calls.push(String(prop)); return value.apply(target, args); };
    },
  });
  return { db: proxy, calls };
}
