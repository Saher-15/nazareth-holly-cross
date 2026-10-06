// Seed data for the local harness: 62 products, 42 orders over 60 days, candle requests, messages, reviews,
// prayers and the accounts. Deterministic names and amounts (dates are relative to "now").
//
// Text is stored the way the real API stores it: the sanitizer writes & < > as HTML entities, so the seed
// contains a few "&amp;" and "&lt;" values on purpose (the dashboard must show them as characters).
// The accounts are created through the REAL create-admin logic (scripts/create-admin.js createOwner), then the
// role / second factor of the spare accounts is set the way the dashboard's own routes do it.
import { createOwner, USERNAME } from '../scripts/create-admin.js';
import { hashPassword } from '../services/adminAuth.js';
import { checkPasswordPolicy } from '../services/passwordPolicy.js';
import { encryptSecret } from '../services/totp.js';
import { models } from './harness-models.js';

// Throw-away passwords. They exist only inside this in-memory harness and are listed in test-harness/README.md.
export const HARNESS_USERS = [
  { username: 'owner', password: 'Owner-Mock-Pass-1', role: 'owner' },
  { username: 'editor', password: 'Editor-Mock-Pass-1', role: 'editor' },
  { username: 'viewer', password: 'Viewer-Mock-Pass-1', role: 'viewer' },
  { username: 'secure', password: 'Secure-Mock-Pass-1', role: 'owner', totpSecret: 'JBSWY3DPEHPK3PXP' },
  // Spare accounts for tests that change state, so they never disturb the four above.
  { username: 'locktest', password: 'Locktest-Mock-Pass-1', role: 'editor' },
  { username: 'tempowner', password: 'Tempowner-Mock-Pass-1', role: 'owner' },
  { username: 'passchange', password: 'Passchange-Mock-Pass-1', role: 'editor' },
  { username: 'totpsetup', password: 'Totpsetup-Mock-Pass-1', role: 'editor' },
];

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
const id = (prefix) => `${prefix}${(++counter).toString(16).padStart(23, '0')}`.slice(0, 24);

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

// name, price, artwork, colours, stock (null = not tracked), category override
const BASE_PRODUCTS = [
  ['Nazareth Beeswax Candle', 18, 'candle', ['white', 'gold'], 60, null],
  ['Annunciation Taper Candles (set of 6)', 24, 'candle', ['white'], 34, null],
  ['Olive Wood Cross', 32, 'cross', [], 22, 'crosses'],
  ['Pilgrim Rosary, Olive Wood', 28, 'rosary', ['brown', 'black'], 4, 'rosaries'],
  ["Mary's Well Icon, hand painted", 96, 'icon', [], 7, 'gifts'],
  ['Holy Land Soap Trio', 15, 'dove', [], 48, 'holy-land'],
  ['Mount Tabor Olive Oil, 500 ml', 21, 'branch', [], 0, 'holy-land'], // the one product that is out of stock
  ['Basilica Star Ornament', 12, 'star', ['gold', 'silver'], 71, 'gifts'],
  ['Carved Nativity Scene', 140, 'cross', [], 3, 'gifts'],
  ['Blessed Holy Water Bottle', 9, 'dove', [], 120, 'holy-land'],
  ['Galilee Dove Pendant', 36, 'dove', ['silver'], 15, 'necklaces'],
  ['Prayer Card Collection', 6, 'star', [], null, 'gifts'],
  ['Fish &amp; Loaves Plate', 27, 'branch', [], 9, 'gifts'], // stored with an entity, as the API stores "&"
];
const KINDS = [
  ['Rosary', 'rosary', 'rosaries', 14], ['Necklace', 'dove', 'necklaces', 30], ['Bracelet', 'star', 'bracelets', 22], ['Bible', 'branch', 'bibles', 25],
  ['Cross', 'cross', 'crosses', 19], ['Stained Glass Vitrage', 'star', 'stained-glass', 58], ['Holy Land Gift Box', 'dove', 'holy-land', 34],
];
const MATERIALS = ['Olive Wood', 'Silver', 'Gold Plated', 'Mother of Pearl', 'Ceramic', 'Glass'];

export function buildData(now = Date.now(), assetBase = 'http://localhost:3911') {
  const rand = rng(20261006);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const day = 86_400_000;
  const at = (ms) => new Date(ms);

  const defs = [...BASE_PRODUCTS];
  for (let i = 0; defs.length < 62; i += 1) {
    const [kind, art, category, base] = KINDS[i % KINDS.length];
    const material = MATERIALS[Math.floor(i / KINDS.length) % MATERIALS.length];
    defs.push([`${material} ${kind} No. ${i + 1}`, base + (i % 7) * 3, art, [], i % 5 === 0 ? 2 + (i % 4) : 5 + ((i * 7) % 90), category]);
  }
  const products = defs.map(([name, price, art, color, stock, category], i) => ({
    _id: id('b'),
    name,
    price,
    img: `${assetBase}/mock/${art}.svg`,
    additionalImageUrls: i % 3 === 0 ? [`${assetBase}/mock/star.svg`] : [],
    description: `${name}. Handmade in Nazareth by local artisans & blessed at the Basilica of the Annunciation.`.replace('&', '&amp;'),
    uuidv4_: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    rate: [1, 2, 3, 4, 5][i % 5],
    color,
    stock,
    ...(category ? { category } : {}),
    createdAt: at(now - (90 - i) * day),
    updatedAt: at(now - (90 - i) * day),
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
    const ageDays = Math.floor((i / 42) * 58 + rand() * 1.5); // spread over the last 60 days, newest first
    const created = now - ageDays * day - Math.floor(rand() * 20) * 3_600_000;
    const first = pick(FIRST);
    let last = pick(LAST);
    if (i === 5) last = '-2+3'; // starts with a character a spreadsheet would run as a formula
    const unverified = i === 7 || i === 19 || i === 33;
    orders.push({
      _id: id('c'),
      firstName: i === 11 ? 'Tom &amp; Jerry' : first,
      lastName: last,
      email: `${first}.${pick(LAST)}${i}@example.com`.toLowerCase(),
      phone: `+1 555 01${String(i).padStart(2, '0')}`,
      street: `${10 + Math.floor(rand() * 90)} Pilgrim Road`,
      city,
      state,
      postal,
      country,
      date: at(created),
      createdAt: at(created),
      updatedAt: at(created),
      totalPrice: Math.round(total * 100) / 100,
      products: lines,
      done: ageDays > 6 ? rand() > 0.08 : rand() > 0.7,
      paymentVerified: !unverified,
      ...(unverified ? {} : { paypalOrderId: `HARNESSPAY${String(1000 + i)}` }),
    });
  }

  const candles = [];
  for (let i = 0; i < 30; i += 1) {
    const first = pick(FIRST);
    const created = now - Math.floor((i / 30) * 30 * day + rand() * day);
    candles.push({
      _id: id('d'),
      firstName: first,
      lastName: pick(LAST),
      email: `${first}${i}@example.org`.toLowerCase(),
      prayer: i === 4 ? '=HYPERLINK(&quot;https://evil.example/&quot;,&quot;click&quot;)' : pick(PRAYERS),
      done: i > 8 ? rand() > 0.15 : false,
      createdAt: at(created),
      updatedAt: at(created),
    });
  }

  const contacts = [];
  for (let i = 0; i < 24; i += 1) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const created = now - Math.floor((i / 24) * 40 * day + rand() * day);
    contacts.push({
      _id: id('e'),
      fullName: i === 2 ? 'ישראל ישראלי' : i === 3 ? 'سامي خوري' : `${first} ${last}`,
      email: `${first}.${last}@example.net`.toLowerCase(),
      phone: i % 3 === 0 ? '' : `+44 20 7946 0${String(100 + i)}`,
      msg: i === 1 ? '@SUM(1+1)*cmd|&#39; /C calc&#39;!A0' : i === 6 ? '+1+1 &lt;script&gt;alert(1)&lt;/script&gt; and "quotes", commas' : pick(MESSAGES),
      done: i > 6 ? rand() > 0.2 : false,
      createdAt: at(created),
      updatedAt: at(created),
    });
  }

  const siteReviews = [];
  for (let i = 0; i < 12; i += 1) {
    const first = pick(FIRST);
    siteReviews.push({
      _id: id('f'),
      fullName: `${first} ${pick(LAST)}`,
      email: i % 2 ? `${first}@example.com`.toLowerCase() : '',
      phone: '000',
      msg: pick(COMMENTS),
      approved: i % 5 !== 3,
      createdAt: at(now - (i + 1) * 2 * day),
      updatedAt: at(now - (i + 1) * 2 * day),
    });
  }

  const productReviews = [];
  for (let i = 0; i < 25; i += 1) {
    const p = pick(products);
    productReviews.push({
      _id: id('9'),
      product: p._id,
      name: `${pick(FIRST)} ${pick(LAST).slice(0, 1)}.`,
      country: pick(CITIES)[1],
      rating: 3 + Math.floor(rand() * 3),
      title: ['Lovely', 'Great gift', 'Worth it', 'As described'][i % 4],
      comment: pick(COMMENTS),
      approved: i % 6 !== 2,
      ipHash: `harness-${i}`,
      createdAt: at(now - (i + 1) * 1.7 * day),
      updatedAt: at(now - (i + 1) * 1.7 * day),
    });
  }

  const prayers = [];
  for (let i = 0; i < 24; i += 1) {
    prayers.push({
      _id: id('8'),
      name: `${pick(FIRST)} ${pick(LAST)}`,
      country: pick(CITIES)[1],
      prayer: pick(PRAYERS),
      category: ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'][i % 6],
      likes: Math.floor(rand() * 40),
      createdAt: at(now - i * 0.9 * day),
      updatedAt: at(now - i * 0.9 * day),
    });
  }

  return { products, orders, candles, contacts, siteReviews, productReviews, prayers };
}

// ---- accounts ----

// Scripted answers to the prompts of the real create-admin conversation.
function scripted(answers) {
  const queue = [...answers];
  return async () => queue.shift();
}

let accountSnapshot = null; // the documents (with their cost-12 hashes), kept so a reset does not hash again

async function createAccounts() {
  const { Admin } = models;
  const created = [];
  for (const user of HARNESS_USERS) {
    if (!USERNAME.test(user.username)) throw new Error(`harness account name ${user.username} is not a valid username`);
    await createOwner({
      ask: scripted([user.username]),
      askHidden: scripted([user.password, user.password]),
      Admin,
      hash: hashPassword,
      checkPassword: checkPasswordPolicy,
      log: () => {},
    });
    const doc = await Admin.findOne({ username: user.username });
    const set = { role: user.role, createdAt: new Date(Date.now() - 90 * 86_400_000) };
    if (user.totpSecret) Object.assign(set, { totpEnabled: true, totpSecretEnc: encryptSecret(user.totpSecret), totpLastStep: -1 });
    await Admin.updateOne({ _id: doc._id }, { $set: set });
    created.push(doc.username);
  }
  return created;
}

export async function seed({ assetBase } = {}) {
  const data = buildData(Date.now(), assetBase ?? process.env.HARNESS_ASSET_BASE ?? 'http://localhost:3911');
  models.Product.seed(data.products);
  models.Order.seed(data.orders);
  models.Candle.seed(data.candles);
  models.Contact.seed(data.contacts);
  models.Review.seed(data.siteReviews);
  models.ProductReview.seed(data.productReviews);
  models.Prayer.seed(data.prayers);

  if (accountSnapshot) {
    for (const doc of accountSnapshot) models.Admin.seed([{ ...doc, failedLogins: 0, lockedUntil: null, lastLoginAt: null, ...(doc.totpEnabled ? { totpLastStep: -1 } : { totpEnabled: false, totpSecretEnc: null, totpLastStep: -1 }) }]);
  } else {
    await createAccounts();
    accountSnapshot = models.Admin.docs.map((d) => JSON.parse(JSON.stringify(d)));
    // The snapshot keeps dates as text; seed() restores them as Dates below.
    accountSnapshot = accountSnapshot.map((d) => ({ ...d, createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt) }));
  }
  return { products: data.products.length, orders: data.orders.length, accounts: HARNESS_USERS.length };
}
