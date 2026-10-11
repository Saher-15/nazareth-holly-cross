import { describe, expect, it } from 'vitest';
import { cartReducer, MAX_LINE_QUANTITY, parseStoredCart, type CartLine } from '@/lib/cart';
import { orderSummary } from '@/lib/pricing';

const oil = { _id: 'a', name: 'Olive oil', price: 10, img: 'x', color: '' };
const rosaryBlue = { _id: 'b', name: 'Rosary', price: 20, img: 'y', color: 'blue' };
const rosaryRed = { ...rosaryBlue, color: 'red' };

describe('cartReducer', () => {
  it('adds a product, then increases the same line', () => {
    let lines: CartLine[] = cartReducer([], { type: 'add', line: oil });
    lines = cartReducer(lines, { type: 'add', line: oil, quantity: 2 });
    expect(lines).toEqual([{ ...oil, quantity: 3 }]);
  });

  it('keeps one line per colour', () => {
    let lines = cartReducer([], { type: 'add', line: rosaryBlue });
    lines = cartReducer(lines, { type: 'add', line: rosaryRed });
    expect(lines).toHaveLength(2);
  });

  it('never goes above the per-product limit the API enforces', () => {
    const lines = cartReducer([], { type: 'add', line: oil, quantity: 999 });
    expect(lines[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('removes a line when its quantity is set to 0', () => {
    const lines = cartReducer([{ ...oil, quantity: 2 }], { type: 'setQuantity', _id: 'a', color: '', quantity: 0 });
    expect(lines).toEqual([]);
  });

  it('removes only the matching colour', () => {
    const lines = cartReducer(
      [
        { ...rosaryBlue, quantity: 1 },
        { ...rosaryRed, quantity: 1 },
      ],
      { type: 'remove', _id: 'b', color: 'red' },
    );
    expect(lines).toEqual([{ ...rosaryBlue, quantity: 1 }]);
  });
});

describe('orderSummary (must match server/services/pricing.js)', () => {
  it('applies 10% off the items and adds $5 shipping', () => {
    expect(orderSummary([{ price: 10, quantity: 2 }])).toEqual({ subtotal: 20, discount: 2, shipping: 5, total: 23 });
  });

  it('is zero for an empty cart', () => {
    expect(orderSummary([]).total).toBe(0);
  });

  // Review of 2026-10-11: the page rounded the discount first and came out a cent away from the charged amount.
  it('gives the same total as the API for every price, to the cent, and rows that add up to it', () => {
    const server = (items: number) => Math.round((items * 0.9 + 5) * 100) / 100; // server/services/pricing.js quoteShopOrder
    expect(orderSummary([{ price: 14.95, quantity: 1 }])).toEqual({ subtotal: 14.95, discount: 1.5, shipping: 5, total: 18.45 });
    for (let cents = 100; cents <= 30000; cents += 5) {
      for (const quantity of [1, 2, 3]) {
        const price = cents / 100;
        const summary = orderSummary([{ price, quantity }]);
        expect(summary.total, `${price} x ${quantity}`).toBe(server(price * quantity));
        expect(Math.round((summary.subtotal - summary.discount + summary.shipping) * 100)).toBe(Math.round(summary.total * 100));
      }
    }
  });
});

describe('parseStoredCart (the stored cart is untrusted input)', () => {
  const line = { ...oil, _id: '64b000000000000000000001', quantity: 2 }; // stored ids are Mongo ObjectIds

  it('reads a well-formed cart', () => {
    expect(parseStoredCart(JSON.stringify([line]))).toEqual([line]);
    expect(parseStoredCart(null)).toEqual([]);
  });

  it('never throws on garbage', () => {
    expect(parseStoredCart('{not json')).toEqual([]);
    expect(parseStoredCart('{"a":1}')).toEqual([]);
    expect(parseStoredCart('null')).toEqual([]);
  });

  it('drops lines that could not have been written by the cart', () => {
    const bad = [
      { ...line, quantity: 0 },
      { ...line, quantity: MAX_LINE_QUANTITY + 1 },
      { ...line, quantity: 1.5 },
      { ...line, price: -3 },
      { ...line, price: null },
      { ...line, name: 5 },
      { ...line, color: undefined },
      'text',
      null,
    ];
    expect(parseStoredCart(JSON.stringify([...bad, line]))).toEqual([line]);
  });

  it('keeps one line per product and colour', () => {
    expect(parseStoredCart(JSON.stringify([line, { ...line, quantity: 9 }]))).toEqual([line]);
  });
});
