import { describe, it, expect, vi } from 'vitest';

// scripts/ensure-indexes.js, scripts/check-data.js and scripts/reconcile-payments.js against an in-memory stand-in for
// the MongoDB driver (no database).

vi.unmock('../model/payment.js'); // these scripts read the REAL model declarations
vi.unmock('../model/liveSession.js');

const { fakeDb } = await import('../test-harness/fake-db.js');
const { ensureIndexes } = await import('../scripts/ensure-indexes.js');
const { checkData, printReport } = await import('../scripts/check-data.js');
const { reconcile, printReport: printReconcile } = await import('../scripts/reconcile-payments.js');
const { MODELS, declaredIndexes, diffIndexes, normaliseActual, collectionNameOf, planIndexes, problemsIn } = await import('../services/indexes.js');
const { recorded, sample, seededDb, newId, ids } = await import('./helpers/ops.js');

const quiet = () => {};
const run = (options) => {
  const lines = [];
  return ensureIndexes({ log: (l) => lines.push(l), ...options }).then((result) => ({ ...result, lines }));
};
const declaredCount = Object.values(MODELS).reduce((n, M) => n + declaredIndexes(M).length, 0);

describe('ensure-indexes', () => {
  it('is a DRY RUN by default: it lists what it would create and changes nothing', async () => {
    const { db, calls } = recorded(seededDb());
    const result = await run({ db });
    expect(result.created).toEqual([]);
    expect(result.lines.filter((l) => /CREATE/.test(l))).toHaveLength(declaredCount);
    expect(result.lines.join('\n')).toMatch(/DRY RUN: nothing was changed/);
    expect(calls.filter((c) => /createIndex|dropIndex|insert|delete|update/.test(c))).toEqual([]);
  });

  it('--apply creates every missing index, and a second run has nothing left to do', async () => {
    const db = seededDb();
    const first = await run({ db, apply: true });
    expect(first.failed).toEqual([]);
    expect(first.created).toHaveLength(declaredCount);

    const second = await run({ db });
    expect(second.lines.join('\n')).toMatch(/Every index the models declare exists/);
    expect(second.plan.flatMap((p) => [...p.missing, ...p.conflict, ...p.extra])).toEqual([]);

    const third = await run({ db, apply: true });
    expect(third.created).toEqual([]);
  });

  it('creates the indexes the queries need (unique payment id, partial unique order / candle id, TTLs, text search)', async () => {
    const db = seededDb();
    await run({ db, apply: true });
    const has = async (collection, test) => (await db.collection(collection).indexes()).some(test);
    expect(await has('payment', (i) => i.unique && JSON.stringify(i.key) === '{"paypalOrderId":1}')).toBe(true);
    expect(await has('order', (i) => i.unique && i.partialFilterExpression?.paypalOrderId?.$type === 'string')).toBe(true);
    expect(await has('candle', (i) => i.unique && i.partialFilterExpression?.paypalOrderId?.$type === 'string')).toBe(true);
    expect(await has('auditLog', (i) => i.expireAfterSeconds === 180 * 24 * 3600)).toBe(true);
    expect(await has('adminSession', (i) => i.expireAfterSeconds === 0)).toBe(true);
    expect(await has('product', (i) => i.key._fts === 'text')).toBe(true);
    expect(await has('order', (i) => JSON.stringify(i.key) === '{"email":1,"createdAt":-1}')).toBe(true);
    expect(await has('admins', (i) => i.unique && JSON.stringify(i.key) === '{"username":1}')).toBe(true); // the collection is "admins"
    expect(await has('prayers', (i) => JSON.stringify(i.key) === '{"category":1,"createdAt":-1}')).toBe(true); // ... and "prayers"
  });

  it('never touches a document', async () => {
    const db = seededDb();
    const before = JSON.stringify(Object.fromEntries(db.names().map((n) => [n, db.docs(n)])));
    await run({ db, apply: true, replaceConflicts: true, prune: true });
    expect(JSON.stringify(Object.fromEntries(db.names().map((n) => [n, db.docs(n)])))).toBe(before);
  });

  it('a conflicting index is reported and left alone, unless --replace-conflicts', async () => {
    const db = seededDb();
    await db.collection('order').createIndex({ paypalOrderId: 1 }, { name: 'paypalOrderId_1' }); // not unique: the model wants unique + partial
    const dry = await run({ db });
    expect(dry.lines.join('\n')).toMatch(/CONFLICT[^\n]*paypalOrderId_1/);
    expect(dry.lines.join('\n')).toMatch(/left alone \(add --replace-conflicts/);

    const kept = await run({ db, apply: true });
    expect(kept.skipped).toEqual([{ collection: 'order', index: 'paypalOrderId_1' }]);
    expect((await db.collection('order').indexes()).find((i) => i.name === 'paypalOrderId_1').unique).toBeUndefined();

    const replaced = await run({ db, apply: true, replaceConflicts: true });
    expect(replaced.dropped).toEqual([{ collection: 'order', index: 'paypalOrderId_1' }]);
    expect((await db.collection('order').indexes()).find((i) => i.name === 'paypalOrderId_1')).toMatchObject({ unique: true });
  });

  it('an index no model declares is listed as EXTRA and only dropped with --prune; _id_ never is', async () => {
    const db = seededDb();
    await run({ db, apply: true });
    await db.collection('order').createIndex({ phone: 1 }, { name: 'old_phone' });
    const listed = await run({ db, apply: true });
    expect(listed.lines.join('\n')).toMatch(/EXTRA[^\n]*old_phone/);
    expect((await db.collection('order').indexes()).some((i) => i.name === 'old_phone')).toBe(true);

    const pruned = await run({ db, apply: true, prune: true });
    expect(pruned.dropped).toEqual([{ collection: 'order', index: 'old_phone' }]);
    expect((await db.collection('order').indexes()).some((i) => i.name === '_id_')).toBe(true);
  });

  it('reports a failure (a unique index over data that already has duplicates) and carries on with the rest', async () => {
    const db = seededDb({ payment: [
      { _id: newId(), paypalOrderId: 'DUPLICATEPAYPAL01', type: 'order', amount: 1 },
      { _id: newId(), paypalOrderId: 'DUPLICATEPAYPAL01', type: 'order', amount: 1 },
    ] });
    const result = await run({ db, apply: true });
    expect(result.failed.map((f) => `${f.collection}.${f.index}`)).toEqual(['payment.paypalOrderId_1']);
    expect(result.created.length).toBe(declaredCount - 1);
  });

  it('the start-up check names what is missing', async () => {
    const db = seededDb();
    expect(problemsIn(await planIndexes(db, MODELS))).toHaveLength(declaredCount);
    await run({ db, apply: true });
    expect(problemsIn(await planIndexes(db, MODELS))).toEqual([]);
  });

  it('a collection that does not exist yet simply has no indexes', async () => {
    const plan = await planIndexes(fakeDb(), MODELS);
    expect(plan.every((p) => p.missing.length > 0)).toBe(true);
  });
});

describe('index comparison', () => {
  it('reads a text index the way MongoDB reports it and sees it equals the declared one', () => {
    const declared = declaredIndexes(MODELS.Product).find((i) => Object.values(i.key).includes('text'));
    const reported = { v: 2, key: { _fts: 'text', _ftsx: 1 }, name: 'name_text_description_text', weights: { name: 1, description: 1 }, default_language: 'english', language_override: 'language', textIndexVersion: 3 };
    expect(diffIndexes([declared], [{ v: 2, key: { _id: 1 }, name: '_id_' }, reported])).toEqual({ missing: [], conflict: [], extra: [] });
    expect(normaliseActual(reported).key).toEqual({ name: 'text', description: 'text' });
  });

  it('does not care about the order of the fields of a text index (production reports them alphabetically)', () => {
    const declared = declaredIndexes(MODELS.Product).find((i) => Object.values(i.key).includes('text'));
    // As the production cluster answered on 2026-10-06 (the false "conflict" warning at start-up).
    const reported = { v: 2, key: { _fts: 'text', _ftsx: 1 }, name: 'name_text_description_text', weights: { description: 1, name: 1 }, default_language: 'english', language_override: 'language', textIndexVersion: 3 };
    expect(diffIndexes([declared], [{ v: 2, key: { _id: 1 }, name: '_id_' }, reported])).toEqual({ missing: [], conflict: [], extra: [] });
    // ... but other weights are still a real difference.
    const reweighted = { ...reported, weights: { description: 1, name: 10 } };
    expect(diffIndexes([declared], [{ v: 2, key: { _id: 1 }, name: '_id_' }, reweighted]).conflict).toHaveLength(1);
  });

  it('notices a different option (unique, TTL seconds, partial filter)', () => {
    const wanted = { name: 'at_1', key: { at: 1 }, options: { expireAfterSeconds: 100 } };
    expect(diffIndexes([wanted], [{ v: 2, key: { at: 1 }, name: 'at_1', expireAfterSeconds: 200 }]).conflict).toHaveLength(1);
    expect(diffIndexes([wanted], [{ v: 2, key: { at: 1 }, name: 'at_1', expireAfterSeconds: 100 }]).conflict).toHaveLength(0);
    expect(diffIndexes([wanted], [{ v: 2, key: { at: 1 }, name: 'renamed', expireAfterSeconds: 100 }]).missing).toHaveLength(0); // same definition, other name: fine
  });

  it('knows every collection name (two are not singular, on purpose)', () => {
    expect(Object.values(MODELS).map(collectionNameOf).sort()).toEqual(
      ['admins', 'adminSession', 'auditLog', 'candle', 'contact', 'liveSession', 'order', 'payment', 'prayers', 'product', 'productReview', 'review'].sort(),
    );
  });
});

describe('check-data', () => {
  const check = (data, options = {}) => checkData({ db: seededDb(data), ...options });
  const kinds = (result) => result.problems.map((p) => `${p.collection}:${p.kind}:${p.detail}`);

  it('finds nothing wrong in healthy data', async () => {
    const result = await check(sample());
    expect(result).toMatchObject({ ok: true, total: 0, problems: [], unknownCollections: [] });
    expect(result.checked.order).toBe(2);
    expect(result.checked.payment).toBe(3);
  });

  it('is read-only', async () => {
    const { db, calls } = recorded(seededDb());
    await checkData({ db });
    expect(new Set(calls.map((c) => c.split('.').pop()))).toEqual(new Set(['find', 'listCollections']));
  });

  it('finds documents that fail their schema, with the kind of failure and the field', async () => {
    const data = sample();
    delete data.order[0].phone; // required
    data.order[0].email = 'not-an-address'; // format
    data.prayers[0].category = 'Gossip'; // enum
    data.candle[0].prayer = 'no'; // too short
    data.product[0].price = 'cheap'; // type
    data.productReview[0].rating = 9; // range
    const result = await check(data);
    expect(kinds(result)).toEqual(expect.arrayContaining([
      'order:missing-required:phone', 'order:bad-format:email', 'prayers:bad-enum:category',
      'candle:out-of-range:prayer', 'product:bad-type:price', 'productReview:out-of-range:rating',
    ]));
    expect(result.ok).toBe(false);
  });

  it('finds orders whose product is gone, reviews of a missing product, and negative stock', async () => {
    const data = sample();
    data.order[0].products.push({ productID: newId(), productName: 'Ghost', quantity: 1 });
    data.productReview[0].product = newId();
    data.product[0].stock = -2;
    const result = await check(data);
    expect(kinds(result)).toEqual(expect.arrayContaining([
      'order:unknown-product-id:products.1.productID', 'productReview:orphan-product:product', 'product:negative-stock:stock',
    ]));
  });

  it('finds duplicate PayPal ids (a missing unique index shows up here), broken payment links and verified-without-id', async () => {
    const data = sample();
    data.payment.push({ ...data.payment[0], _id: newId() }); // same paypalOrderId twice
    data.order.push({ ...data.order[0], _id: newId() }); // same paypalOrderId on two orders
    data.payment[1].linkedTo.id = newId(); // candle payment pointing at nothing
    data.payment[2].linkedTo = { kind: 'order', id: ids.order2 }; // donation linked to an order with another id
    data.order[1].paymentVerified = true; // verified, but no PayPal id
    const result = await check(data);
    expect(kinds(result)).toEqual(expect.arrayContaining([
      'payment:duplicate-paypal-order-id:paypalOrderId', 'order:duplicate-paypal-order-id:paypalOrderId',
      'payment:orphan-link:linkedTo.id', 'payment:link-mismatch:linkedTo.id', 'order:verified-without-payment-id:paypalOrderId',
    ]));
  });

  it('finds accounts whose names differ only by case, and sessions of a deleted account', async () => {
    const data = sample();
    data.admins.push({ ...data.admins[0], _id: newId(), username: 'OWNER' });
    data.adminSession[0].admin = newId();
    const result = await check(data);
    expect(kinds(result)).toEqual(expect.arrayContaining(['admins:duplicate-username:username', 'adminSession:orphan-session:admin']));
  });

  it('mentions collections no model knows about, without calling them a failure', async () => {
    const data = sample();
    data.legacyThing = [{ _id: newId() }];
    const result = await check(data);
    expect(result.unknownCollections).toEqual(['legacyThing']);
    expect(result.ok).toBe(true);
  });

  it('counts every problem but lists only the first few examples of each kind', async () => {
    const data = sample();
    data.order = Array.from({ length: 30 }, () => ({ ...data.order[0], _id: newId(), paypalOrderId: undefined, paymentVerified: false, email: 'bad' }));
    const result = await check(data, { maxExamples: 3 });
    expect(result.counts['order: bad-format']).toBe(30);
    expect(result.problems.filter((p) => p.kind === 'bad-format')).toHaveLength(3);
  });

  it('never prints a name, an e-mail address or a message: only collections, ids, fields and kinds', async () => {
    const data = sample();
    data.order[0].email = 'maria.private@example.com-not-valid';
    data.order[0].lastName = 'x'.repeat(300);
    const result = await check(data);
    const lines = [];
    printReport(result, (l) => lines.push(l));
    const output = JSON.stringify(result) + lines.join('\n');
    expect(output).not.toMatch(/maria|private|Rossi|Via Roma|xxxx/i);
    expect(output).toMatch(/out-of-range/);
  });
});

describe('reconcile-payments', () => {
  const NOW = new Date('2026-10-20T12:00:00Z');
  const ago = (minutes) => new Date(NOW.getTime() - minutes * 60_000);
  const pay = (over) => ({ _id: newId(), type: 'order', amount: 23, currency: 'USD', status: 'captured', capturedAt: ago(120), createdAt: ago(125), ...over });
  const order = (over) => ({ _id: newId(), createdAt: ago(100), paypalOrderId: undefined, ...over });

  it('lists captured payments with no order or candle, and says how much money that is', async () => {
    const db = seededDb({
      payment: [pay({ paypalOrderId: 'PAIDNOORDER00001' }), pay({ paypalOrderId: 'PAIDNOCANDLE0001', type: 'candle', amount: 3 }), pay({ paypalOrderId: 'DONATION0000001', type: 'donation' })],
      order: [], candle: [],
    });
    const report = await reconcile({ db, now: NOW });
    expect(report.unfulfilled.map((p) => p.paypalOrderId).sort()).toEqual(['PAIDNOCANDLE0001', 'PAIDNOORDER00001']);
    expect(report.unfulfilledAmount).toBe('26.00');
    expect(report.needsAttention).toBe(2);
  });

  it('does not count a payment that is only minutes old (the browser is still saving it), a linked one, a resolved one or a donation', async () => {
    const orderId = newId();
    const db = seededDb({
      payment: [
        pay({ paypalOrderId: 'JUSTNOW000000001', capturedAt: ago(3) }),
        pay({ paypalOrderId: 'LINKED0000000001', linkedTo: { kind: 'order', id: orderId } }),
        pay({ paypalOrderId: 'RESOLVED000000001', resolvedAt: ago(10) }),
        pay({ paypalOrderId: 'DONATION00000001', type: 'donation' }),
        pay({ paypalOrderId: 'CREATEDONLY000001', status: 'created', capturedAt: null, createdAt: ago(5) }),
      ],
      order: [{ _id: orderId, paypalOrderId: 'LINKED0000000001', createdAt: ago(100) }], candle: [],
    });
    const report = await reconcile({ db, now: NOW });
    expect(report.unfulfilled).toEqual([]);
    expect(report.recent.map((p) => p.paypalOrderId)).toEqual(['JUSTNOW000000001']);
    expect(report.needsAttention).toBe(0);
  });

  it('finds payments linked to an order or candle that was deleted', async () => {
    const db = seededDb({ payment: [pay({ paypalOrderId: 'DANGLING0000001', linkedTo: { kind: 'order', id: newId() } })], order: [], candle: [] });
    const report = await reconcile({ db, now: NOW });
    expect(report.dangling).toHaveLength(1);
    expect(report.needsAttention).toBe(1);
  });

  it('finds payments started more than a day ago and never captured (check PayPal)', async () => {
    const db = seededDb({ payment: [pay({ paypalOrderId: 'STALE00000000001', status: 'created', capturedAt: null, createdAt: ago(60 * 30) }), pay({ paypalOrderId: 'RECENTCREATED001', status: 'created', capturedAt: null, createdAt: ago(60) })], order: [], candle: [] });
    const report = await reconcile({ db, now: NOW });
    expect(report.stale.map((p) => p.paypalOrderId)).toEqual(['STALE00000000001']);
  });

  it('after the cut-over, finds orders and candles without a PayPal id, and ones the ledger does not know', async () => {
    const db = seededDb({
      payment: [pay({ paypalOrderId: 'FIRSTLEDGERROW01', createdAt: ago(60 * 24 * 3), capturedAt: ago(60 * 24 * 3), linkedTo: { kind: 'order', id: ids.order1 } })],
      order: [
        order({ _id: ids.order1, createdAt: ago(60 * 24 * 3), paypalOrderId: 'FIRSTLEDGERROW01' }),
        order({ createdAt: ago(60 * 24 * 4) }), // before the cut-over: not reported
        order({ createdAt: ago(60 * 24 * 2) }), // after, no PayPal id
        order({ createdAt: ago(60 * 24), paypalOrderId: 'NOTINLEDGER00001' }), // after, id unknown to the ledger
      ],
      candle: [order({ createdAt: ago(60 * 24), paypalOrderId: undefined })],
    });
    const report = await reconcile({ db, now: NOW });
    expect(report.cutover).toBe(ago(60 * 24 * 3).toISOString());
    expect(report.noPaymentId.order).toHaveLength(1);
    expect(report.noPaymentId.candle).toHaveLength(1);
    expect(report.noLedgerRow.order.map((o) => o.paypalOrderId)).toEqual(['NOTINLEDGER00001']);
    expect(report.unfulfilled).toEqual([]);
  });

  it('--since sets the cut-over, and an empty ledger has none', async () => {
    const db = seededDb({ payment: [], order: [order({ createdAt: ago(60 * 24) })], candle: [] });
    expect((await reconcile({ db, now: NOW })).cutover).toBeNull();
    const report = await reconcile({ db, now: NOW, since: new Date('2026-10-01T00:00:00Z') });
    expect(report.noPaymentId.order).toHaveLength(1);
  });

  it('is read-only, and its report shows no names or e-mail addresses', async () => {
    const { db, calls } = recorded(seededDb({ payment: [pay({ paypalOrderId: 'PRIVATE000000001', payerEmail: 'zanzibar.quill@example.com', payerName: 'Zanzibar Quill' })], order: [], candle: [] }));
    const report = await reconcile({ db, now: NOW });
    expect(new Set(calls.map((c) => c.split('.').pop()))).toEqual(new Set(['find']));
    const lines = [];
    printReconcile(report, (l) => lines.push(l));
    expect(JSON.stringify(report) + lines.join('\n')).not.toMatch(/zanzibar|quill/i);
    expect(lines.join('\n')).toMatch(/UNFULFILLED[^\n]*: 1/);
  });
});
