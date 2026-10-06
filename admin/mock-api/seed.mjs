// Deterministic seed data for the mock API: the same names, amounts and relative dates on every start.
import { scryptSync, randomBytes } from 'node:crypto';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let counter = 0;
export function newId(prefix = 'a') {
  counter += 1;
  return `${prefix}${counter.toString(16).padStart(23, '0')}`.slice(0, 24);
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  return { salt, hash: scryptSync(password, salt, 32) };
}

/** Mock-only credentials. They exist so the dashboard can be run and tested without the real server. */
export const MOCK_USERS = [
  { username: 'owner', password: 'Owner-Mock-Pass-1', role: 'owner' },
  { username: 'editor', password: 'Editor-Mock-Pass-1', role: 'editor' },
  { username: 'viewer', password: 'Viewer-Mock-Pass-1', role: 'viewer' },
  { username: 'secure', password: 'Secure-Mock-Pass-1', role: 'owner', totpSecret: 'JBSWY3DPEHPK3PXP' },
  // Spare accounts for tests that change state, so they never disturb the four above.
  { username: 'locktest', password: 'Locktest-Mock-Pass-1', role: 'editor' },
  { username: 'tempowner', password: 'Tempowner-Mock-Pass-1', role: 'owner' },
  { username: 'passchange', password: 'Passchange-Mock-Pass-1', role: 'editor' },
  { username: 'totpsetup', password: 'Totpsetup-Mock-Pass-1', role: 'editor' },
  // Spare account with an e-mail address, for the forgotten-password tests (an invented address).
  { username: 'resetpass', password: 'Resetpass-Mock-Pass-1', role: 'editor', email: 'resetpass@example.com' },
];

const FIRST = ['Maria', 'John', 'Elena', 'Michael', 'Sofia', 'David', 'Anna', 'Paul', 'Rita', 'George', 'Layla', 'Samir', 'Noa', 'Daniel', 'Grace', 'Luca', 'Hana', 'Peter', 'Yusef', 'Clara'];
const LAST = ['Rossi', 'Smith', 'Haddad', 'Kowalski', 'Cohen', 'Nasser', 'Weber', 'Dubois', 'Silva', 'Costa', 'Khoury', 'Novak', 'Ortiz', 'Murphy', 'Ivanov', 'Bishara'];
const CITIES = [
  ['Rome', 'Italy', 'RM', '00184'], ['Boston', 'United States', 'MA', '02108'], ['Warsaw', 'Poland', 'MZ', '00-001'], ['Nazareth', 'Israel', 'NZ', '1610000'],
  ['Madrid', 'Spain', 'MD', '28013'], ['Lyon', 'France', 'ARA', '69002'], ['Manila', 'Philippines', 'NCR', '1000'], ['Sao Paulo', 'Brazil', 'SP', '01310'],
  ['Dublin', 'Ireland', 'D', 'D02'], ['Berlin', 'Germany', 'BE', '10115'], ['Sydney', 'Australia', 'NSW', '2000'], ['Toronto', 'Canada', 'ON', 'M5H'],
];
const PRAYERS = [
  'For my family and for peace in our home.', 'Thank you for a safe journey to the Holy Land.', 'Please pray for my mother who is ill.', 'For peace in the world and an end to war.',
  'Light a candle for our new baby.', 'In memory of my father, who always dreamed of Nazareth.', 'For strength in a difficult season.', 'Thanksgiving for a healing we did not expect.',
];
const MESSAGES = [
  'Hello, do you ship olive wood crosses to Australia?', 'My order has not arrived yet, can you check the tracking?', 'Could I arrange a group visit with candles for 20 pilgrims?',
  'Thank you for the beautiful rosary, it arrived in perfect condition.', 'Do you accept bank transfers for large orders?', 'The colour of the candle differs from the photo. Can I exchange it?',
  'Can you send an invoice for my parish?', 'Is the Nazareth soap suitable for sensitive skin?',
];
const COMMENTS = [
  'Beautiful craftsmanship, exactly as described.', 'Arrived quickly and well packed. A lovely gift.', 'The candle burns evenly and smells wonderful.', 'Good quality for the price.',
  'A little smaller than I expected but very nice.', 'My whole parish ordered these. Highly recommended.', 'The cross is smooth and heavy, a real keepsake.',
];

export const PRODUCT_DEFS = [
  ['Nazareth Beeswax Candle', 18, 'candle', ['white', 'gold'], 60, null],
  ['Annunciation Taper Candles (set of 6)', 24, 'candle', ['white'], 34, null],
  ['Olive Wood Cross', 32, 'cross', [], 22, 'crosses'],
  ['Pilgrim Rosary, Olive Wood', 28, 'rosary', ['brown', 'black'], 4, 'rosaries'],
  ['Mary\'s Well Icon, hand painted', 96, 'icon', [], 7, 'gifts'],
  ['Holy Land Soap Trio', 15, 'dove', [], 48, 'gifts'],
  ['Mount Tabor Olive Oil, 500 ml', 21, 'branch', [], 0, 'gifts'],
  ['Basilica Star Ornament', 12, 'star', ['gold', 'silver'], 71, 'gifts'],
  ['Carved Nativity Scene', 140, 'cross', [], 3, 'gifts'],
  ['Blessed Holy Water Bottle', 9, 'dove', [], 120, 'gifts'],
  ['Galilee Dove Pendant', 36, 'dove', ['silver'], 15, 'necklaces'],
  ['Prayer Card Collection', 6, 'star', [], null, 'gifts'],
  ['Fish &amp; Loaves Plate', 27, 'branch', [], 9, 'gifts'], // stored with an entity, as the real API stores "&"
];

export function buildSeed(now = Date.now(), assetBase = 'http://localhost:3901') {
  const rand = rng(20260929);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const day = 86_400_000;
  const iso = (ms) => new Date(ms).toISOString();

  const products = PRODUCT_DEFS.map(([name, price, art, color, stock, category], i) => ({
    _id: newId('b'),
    name,
    price,
    img: `${assetBase}/mock/${art}.svg`,
    additionalImageUrls: i % 3 === 0 ? [`${assetBase}/mock/star.svg`] : [],
    description: `${name}. Handmade in Nazareth by local artisans and blessed at the Basilica of the Annunciation.`,
    uuidv4_: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    rate: [1, 2, 3, 4, 5][i % 5],
    color,
    stock,
    category,
    createdAt: iso(now - (60 - i) * day),
  }));

  const orders = [];
  for (let i = 0; i < 42; i += 1) {
    const [city, country, state, postal] = pick(CITIES);
    const lineCount = 1 + Math.floor(rand() * 3);
    const lines = [];
    let total = 0;
    for (let l = 0; l < lineCount; l += 1) {
      const p = pick(products);
      const quantity = 1 + Math.floor(rand() * 3);
      total += p.price * quantity;
      lines.push({ productID: p._id, productName: p.name, quantity, color: p.color[0] ?? '' });
    }
    const ageDays = Math.floor((i / 42) * 33 + rand() * 1.5);
    const created = now - ageDays * day - Math.floor(rand() * 20) * 3_600_000;
    const first = pick(FIRST);
    const last = i === 5 ? '-2+3' : pick(LAST); // starts with a character a spreadsheet would run as a formula
    const unverified = i === 7 || i === 19 || i === 33;
    orders.push({
      _id: newId('c'),
      firstName: i === 11 ? 'Tom &amp; Jerry' : first,
      lastName: last,
      email: `${first}.${last.replace(/[^a-z]/gi, '')}${i}@example.com`.toLowerCase(),
      phone: `+1 555 01${String(i).padStart(2, '0')}`,
      street: `${10 + Math.floor(rand() * 90)} Pilgrim Road`,
      city,
      state,
      postal,
      country,
      date: iso(created),
      createdAt: iso(created),
      totalPrice: Math.round(total * 100) / 100,
      products: lines,
      done: ageDays > 6 ? rand() > 0.08 : rand() > 0.7,
      paymentVerified: !unverified,
      ...(unverified ? {} : { paypalOrderId: `MOCKPAY${String(1000 + i)}` }),
    });
  }

  const candles = [];
  for (let i = 0; i < 30; i += 1) {
    const first = pick(FIRST);
    const created = now - Math.floor((i / 30) * 30 * day + rand() * day);
    candles.push({
      _id: newId('d'),
      firstName: first,
      lastName: pick(LAST),
      email: `${first}${i}@example.org`.toLowerCase(),
      prayer: i === 4 ? '=HYPERLINK("https://evil.example/","click")' : pick(PRAYERS),
      done: i > 8 ? rand() > 0.15 : false,
      createdAt: iso(created),
    });
  }

  const contacts = [];
  for (let i = 0; i < 24; i += 1) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const created = now - Math.floor((i / 24) * 40 * day + rand() * day);
    contacts.push({
      _id: newId('e'),
      fullName: `${first} ${last}`,
      email: `${first}.${last}@example.net`.toLowerCase(),
      phone: i % 3 === 0 ? '' : `+44 20 7946 0${String(100 + i)}`,
      msg: i === 1 ? "@SUM(1+1)*cmd|' /C calc'!A0" : i === 6 ? '+1+1 and "quotes", commas' : pick(MESSAGES),
      done: i > 6 ? rand() > 0.2 : false,
      createdAt: iso(created),
    });
  }

  const siteReviews = [];
  const PLACES = ['Italy', 'Brazil', 'Trinidad &amp; Tobago', 'Philippines', 'Poland']; // stored as the API stores "&"
  for (let i = 0; i < 12; i += 1) {
    const first = pick(FIRST);
    // Like the API (server/test-harness/seed.mjs): `place` since 2026-10-06, older reviews kept it in `email` (every 4th).
    siteReviews.push({
      _id: newId('f'),
      fullName: `${first} ${pick(LAST)}`,
      email: i % 2 ? `${first}@example.com`.toLowerCase() : i % 4 === 0 ? 'Germany' : '',
      ...(i % 4 === 0 ? {} : { place: PLACES[i % PLACES.length] }),
      phone: '000',
      msg: pick(COMMENTS),
      approved: i % 5 !== 3,
      createdAt: iso(now - (i + 1) * 2 * day),
    });
  }

  const productReviews = [];
  for (let i = 0; i < 16; i += 1) {
    const p = pick(products);
    productReviews.push({
      _id: newId('9'),
      product: { _id: p._id, name: p.name },
      name: `${pick(FIRST)} ${pick(LAST).slice(0, 1)}.`,
      country: pick(CITIES)[1],
      rating: 3 + Math.floor(rand() * 3),
      title: ['Lovely', 'Great gift', 'Worth it', 'As described'][i % 4],
      comment: pick(COMMENTS),
      approved: i % 6 !== 2,
      createdAt: iso(now - (i + 1) * 1.7 * day),
    });
  }

  const prayers = [];
  for (let i = 0; i < 24; i += 1) {
    prayers.push({
      _id: newId('8'),
      name: `${pick(FIRST)} ${pick(LAST)}`,
      country: pick(CITIES)[1],
      prayer: pick(PRAYERS),
      category: ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'][i % 6],
      likes: Math.floor(rand() * 40),
      createdAt: iso(now - i * 0.9 * day),
    });
  }

  // The payment ledger (server/model/payment.js): every verified order has its captured, linked payment, plus the
  // cases the Payments screen is for.
  const payments = orders.filter((o) => o.paypalOrderId).map((o) => ({
    _id: newId('a'), paypalOrderId: o.paypalOrderId, type: 'order', amount: o.totalPrice, currency: 'USD', status: 'captured', capturedAt: o.createdAt,
    payerEmail: o.email, payerName: `${o.firstName} ${o.lastName}`, linkedTo: { kind: 'order', id: o._id }, resolvedAt: null, createdAt: o.createdAt,
  }));
  const extra = (paypalOrderId, over) => ({
    _id: newId('a'), paypalOrderId, currency: 'USD', status: 'captured', resolvedAt: null, createdAt: iso(now - 2 * day), capturedAt: iso(now - 2 * day), ...over,
  });
  payments.push(
    // Paid, but the browser never saved the order / the candle: the "Paid, not fulfilled" alert
    extra('MOCKLOST0001', { type: 'order', amount: 41.5, payerEmail: 'lost.order@example.com', payerName: 'Lena Lost', createdAt: iso(now - 3 * 3_600_000), capturedAt: iso(now - 3 * 3_600_000) }),
    extra('MOCKLOST0002', { type: 'candle', amount: 3, payerEmail: 'lost.candle@example.com', payerName: 'Carl Candle' }),
    // Dealt with by hand
    extra('MOCKDONE0001', { type: 'order', amount: 18, payerEmail: 'refunded@example.com', payerName: 'Rita Refund', resolvedAt: iso(now - day), resolvedBy: 'owner', notes: 'Refunded in PayPal and the customer was told by e-mail.' }),
    // Donations have no second step
    extra('MOCKGIFT0001', { type: 'donation', amount: 50, donorName: 'Anna K.', payerEmail: 'anna.k@example.com', payerName: 'Anna Kowalski' }),
    extra('MOCKGIFT0002', { type: 'donation', amount: 10, createdAt: iso(now - 9 * day), capturedAt: iso(now - 9 * day) }),
    // Started and abandoned, and a declined card
    extra('MOCKOPEN0001', { type: 'order', amount: 27, status: 'created', capturedAt: null, createdAt: iso(now - 5 * day) }),
    extra('MOCKFAIL0001', { type: 'candle', amount: 3, status: 'failed', capturedAt: null, notes: 'capture ended as DECLINED' }),
  );

  return { products, orders, candles, contacts, siteReviews, productReviews, prayers, payments };
}
