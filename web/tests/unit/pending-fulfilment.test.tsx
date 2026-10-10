import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DonePanel from '@/components/checkout/DonePanel';
import { useSaveAfterPayment } from '@/components/checkout/hooks';
import type { PostResult } from '@/lib/apiClient';
import {
  BACKOFF_MS,
  cartSignature,
  classify,
  MAX_AGE_MS,
  MAX_RECORDS,
  PendingFulfilment,
  pendingFulfilment,
  readRecords,
  retryDelay,
  STORAGE_KEY,
  type PendingEvent,
} from '@/lib/pendingFulfilment';
import { captureWithRetry, isLostAnswer } from '@/lib/paypal';
import en from '@/messages/en.json';

// A customer who has PAID must never end up without an order because the second call failed: the order is written to
// the browser first, retried with a growing delay, retried on the next visit, and removed only when the API confirms.

const ID = 'ABCDEFGHIJ0123456';
const ID2 = 'ZYXWVUTSRQ6543210';
const ok = (data: unknown = 'Created'): PostResult<unknown> => ({ ok: true, data });
const fail = (status: number, error = 'x'): PostResult<unknown> => ({ ok: false, status, error });

class MemoryStore {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
  stored = () => JSON.parse(this.data.get(STORAGE_KEY) ?? '[]') as { paypalOrderId: string; attempts: number; state: string; nextAt: number }[];
}

const orderInput = (id = ID) => ({
  paypalOrderId: id,
  kind: 'order' as const,
  path: '/order/newOrder' as const,
  body: { firstName: 'Maria', email: 'maria@example.com', products: [{ productID: '66eb4665c7e03262956c8d1d', quantity: 2 }] },
  cart: cartSignature([{ _id: '66eb4665c7e03262956c8d1d', color: 'brown', quantity: 2 }]),
});

function engine(posts: PostResult<unknown>[] | ((path: string, body: unknown) => Promise<PostResult<unknown>>), clock = { now: 1_000_000 }) {
  const store = new MemoryStore();
  const calls: { path: string; body: Record<string, unknown>; storedAtCall: string[] }[] = [];
  const queue = Array.isArray(posts) ? [...posts] : null;
  const timers: { run: () => void; ms: number }[] = [];
  const instance = new PendingFulfilment({
    store,
    now: () => clock.now,
    setTimer: (run, ms) => { const t = { run, ms }; timers.push(t); return t; },
    clearTimer: (handle) => { const i = timers.indexOf(handle as (typeof timers)[number]); if (i >= 0) timers.splice(i, 1); },
    post: async (path, body) => {
      // what the browser held at the moment of the request: proof the record was written BEFORE it
      calls.push({ path, body: body as Record<string, unknown>, storedAtCall: store.stored().map((r) => r.paypalOrderId) });
      if (typeof posts === 'function') return posts(path, body);
      return queue!.length > 1 ? queue!.shift()! : queue![0];
    },
  });
  return { instance, store, calls, timers, clock };
}

describe('classify: what an answer of the API means for a record', () => {
  it('2xx means saved', () => expect(classify(ok())).toBe('saved'));

  it('409 "already used" means saved: an earlier attempt got through and only its answer was lost', () => {
    expect(classify(fail(409, 'This payment was already used for an order'))).toBe('saved');
    expect(classify(fail(409, 'This payment was already used for a candle'))).toBe('saved');
    expect(classify(fail(409, 'Already exists'))).toBe('saved');
  });

  it('409 for anything else (not enough stock) is NOT saved: a person must look', () => {
    expect(classify(fail(409, 'Not enough stock for Olive oil'))).toBe('rejected');
  });

  it('402 amount does not match is NOT retried: the price changed since the payment, a person must look', () => {
    expect(classify(fail(402, 'Payment amount does not match the order'))).toBe('rejected');
  });

  it.each([0, 408, 425, 429, 500, 502, 503, 504, 402])('%s is worth trying again (the network, the API, or PayPal lagging behind)', (status) => {
    expect(classify(fail(status))).toBe('retry');
  });

  it.each([400, 401, 403, 404, 413, 422])('%s is refused for good', (status) => {
    expect(classify(fail(status))).toBe('rejected');
  });
});

describe('the record is written before anything is sent, and removed only when the API confirms', () => {
  it('persists before capture and resumes capture before fulfilment after a refresh', async () => {
    const {instance,store,calls,clock} = engine([ok({status:'COMPLETED'}),ok()]);
    instance.prepare(orderInput());
    expect(store.stored()).toMatchObject([{paypalOrderId:ID,capturePending:true}]);
    const resumed = new PendingFulfilment({store,now:()=>clock.now,post:async (path,body)=>{
      calls.push({path,body:body as Record<string,unknown>,storedAtCall:store.stored().map(r=>r.paypalOrderId)});
      return path === '/order/complete_order' ? ok({status:'COMPLETED'}) : ok();
    }});
    expect(await resumed.attempt(ID)).toBe('saved');
    expect(calls.map(c=>c.path)).toEqual(['/order/complete_order','/order/newOrder']);
    expect(calls[0].storedAtCall).toEqual([ID]);
    expect(store.stored()).toEqual([]);
  });

  it('keeps a pending or lost capture answer and never submits an unpaid order', async () => {
    const {instance,store,calls} = engine([fail(502),ok({status:'PENDING'})]);
    instance.prepare(orderInput());
    expect(await instance.attempt(ID)).toBe('retry');
    expect(await instance.attempt(ID)).toBe('retry');
    expect(calls.map(c=>c.path)).toEqual(['/order/complete_order','/order/complete_order']);
    expect(store.stored()).toHaveLength(1);
  });

  it('refuses preparation when durable storage is unavailable', () => {
    const instance = new PendingFulfilment({store:null});
    expect(()=>instance.prepare(orderInput())).toThrow('storage is unavailable');
    expect(instance.list()).toEqual([]);
  });

  it('confirms a donation without creating an order or charging a second payment', async () => {
    const {instance,calls,store} = engine([ok({status:'COMPLETED'})]);
    instance.prepare({paypalOrderId:ID,kind:'donation',path:'/order/complete_order',body:{}});
    expect(await instance.attempt(ID)).toBe('saved');
    expect(calls.map(c=>c.path)).toEqual(['/order/complete_order']);
    expect(store.stored()).toEqual([]);
  });
  it('writes the order to storage first, sends it with the payment id, then removes it', async () => {
    const { instance, store, calls } = engine([ok()]);
    instance.add(orderInput());
    expect(store.stored().map((r) => r.paypalOrderId)).toEqual([ID]); // stored, nothing sent yet
    expect(calls).toHaveLength(0);

    expect(await instance.attempt(ID)).toBe('saved');
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('/order/newOrder');
    expect(calls[0].body).toMatchObject({ firstName: 'Maria', paypalOrderId: ID });
    expect(calls[0].storedAtCall).toEqual([ID]); // it was in storage while the request was in flight
    expect(store.stored()).toEqual([]);
    expect(store.data.has(STORAGE_KEY)).toBe(false);
  });

  it('keeps the record when the connection fails and plans the next attempt', async () => {
    const { instance, store, clock } = engine([fail(0, 'network')]);
    instance.add(orderInput());
    expect(await instance.attempt(ID)).toBe('retry');
    const [record] = store.stored();
    expect(record).toMatchObject({ paypalOrderId: ID, attempts: 1, state: 'pending' });
    expect(record.nextAt).toBe(clock.now + BACKOFF_MS[0]);
  });

  it('the delay grows with each failure and then stays at 15 minutes', async () => {
    const { instance, store, clock } = engine([fail(503)]);
    instance.add(orderInput());
    const delays: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      await instance.attempt(ID);
      delays.push(store.stored()[0].nextAt - clock.now);
    }
    expect(delays).toEqual([2_000, 5_000, 15_000, 45_000, 120_000, 300_000, 900_000, 900_000, 900_000]);
    expect(retryDelay(0)).toBe(2_000);
  });

  it('a record that fails and then succeeds is gone', async () => {
    const { instance, store } = engine([fail(0), fail(502), ok()]);
    instance.add(orderInput());
    expect(await instance.attempt(ID)).toBe('retry');
    expect(await instance.attempt(ID)).toBe('retry');
    expect(await instance.attempt(ID)).toBe('saved');
    expect(store.stored()).toEqual([]);
  });

  it('a payment the API already has (409 already used) is cleared, so a retry after a lost answer ends cleanly', async () => {
    const { instance, store } = engine([fail(409, 'This payment was already used for an order')]);
    instance.add(orderInput());
    expect(await instance.attempt(ID)).toBe('saved');
    expect(store.stored()).toEqual([]);
  });

  it('an order the API refuses for good is KEPT (the customer paid: it is the evidence) but not retried by itself', async () => {
    const { instance, store, calls } = engine([fail(409, 'Not enough stock for Olive oil')]);
    instance.add(orderInput());
    expect(await instance.attempt(ID)).toBe('rejected');
    expect(store.stored()[0]).toMatchObject({ paypalOrderId: ID, state: 'rejected' });
    expect(await instance.attempt(ID)).toBe('rejected'); // not sent again
    expect(calls).toHaveLength(1);
    await instance.runDue();
    expect(calls).toHaveLength(1);
  });

  it('"try again" (force) sends a refused record once more', async () => {
    const { instance, calls } = engine([fail(422), ok()]);
    instance.add(orderInput());
    expect(await instance.attempt(ID)).toBe('rejected');
    expect(await instance.attempt(ID, { force: true })).toBe('saved');
    expect(calls).toHaveLength(2);
  });

  it('never sends one payment twice at the same moment (the page and the retry loop)', async () => {
    let release: (r: PostResult<unknown>) => void = () => undefined;
    const { instance, calls } = engine(() => new Promise((resolve) => { release = resolve; }));
    instance.add(orderInput());
    const first = instance.attempt(ID);
    expect(await instance.attempt(ID)).toBe('busy');
    release(ok());
    expect(await first).toBe('saved');
    expect(calls).toHaveLength(1);
  });

  it('a candle request goes to its own route with its own payment id', async () => {
    const { instance, calls } = engine([ok('Success')]);
    instance.add({ paypalOrderId: ID, kind: 'candle', path: '/candle/lightACandle', body: { firstName: 'Ann', prayer: 'Annunciation church, Peace' } });
    await instance.attempt(ID);
    expect(calls[0]).toMatchObject({ path: '/candle/lightACandle', body: { firstName: 'Ann', paypalOrderId: ID } });
  });

  it('several payments are kept apart', async () => {
    const { instance, store } = engine([ok(), fail(0)]);
    instance.add(orderInput(ID));
    instance.add(orderInput(ID2));
    await instance.attempt(ID);
    await instance.attempt(ID2);
    expect(store.stored().map((r) => r.paypalOrderId)).toEqual([ID2]);
  });

  it('answers "none" for a payment it does not hold', async () => {
    expect(await engine([ok()]).instance.attempt(ID)).toBe('none');
  });
});

describe('the next visit', () => {
  it('a new page load finds the records of the earlier visit and sends them at once', async () => {
    const first = engine([fail(0)]);
    first.instance.add(orderInput());
    await first.instance.attempt(ID); // the connection fails; the customer closes the tab

    // a NEW engine (a new page load) over the SAME storage
    const calls: string[] = [];
    const second = new PendingFulfilment({
      store: first.store,
      now: () => first.clock.now + 3 * 24 * 3600 * 1000, // three days later
      setTimer: () => 0,
      clearTimer: () => undefined,
      post: async (path) => { calls.push(path); return ok(); },
    });
    const { inherited, stop } = second.start({ window: null, document: null });
    expect(inherited).toEqual([ID]);
    await waitFor(() => expect(calls).toEqual(['/order/newOrder']));
    await waitFor(() => expect(first.store.stored()).toEqual([]));
    stop();
  });

  it('the loop keeps the schedule while the page is open (a timer for the next attempt)', async () => {
    const { instance, timers, calls } = engine([fail(0), ok()]);
    const events: PendingEvent['type'][] = [];
    instance.subscribe((e) => events.push(e.type));
    instance.add(orderInput());
    const { stop } = instance.start({ window: null, document: null });
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(timers.length).toBeGreaterThan(0));
    expect(events).toContain('retry');
    stop();
    expect(timers).toHaveLength(0); // stopping cancels the timer
  });

  it('a new visit tries every waiting record at once, whatever its delay was', async () => {
    const { instance, calls } = engine([fail(0), ok()]);
    instance.add(orderInput());
    await instance.attempt(ID); // failed: the next attempt would be 2 s away
    const { stop } = instance.start({ window: null, document: null });
    await waitFor(() => expect(calls).toHaveLength(2));
    stop();
  });

  it('coming back online tries at once instead of waiting out the delay', async () => {
    const handlers: Record<string, () => void> = {};
    const win = { addEventListener: (type: string, fn: () => void) => { handlers[type] = fn; }, removeEventListener: () => undefined };
    const { instance, calls } = engine([fail(0), ok()]);
    const { stop } = instance.start({ window: win, document: null }); // nothing waiting yet
    instance.add(orderInput());
    await instance.attempt(ID); // failed: the next attempt is 2 s away
    expect(calls).toHaveLength(1);
    handlers.online();
    await waitFor(() => expect(calls).toHaveLength(2));
    stop();
  });

  it('showing the tab again also tries at once', async () => {
    const handlers: Record<string, () => void> = {};
    const doc = { visibilityState: 'hidden', addEventListener: (type: string, fn: () => void) => { handlers[type] = fn; }, removeEventListener: () => undefined };
    const { instance, calls } = engine([fail(0), fail(0), ok()]);
    const { stop } = instance.start({ window: null, document: doc }); // nothing waiting yet
    instance.add(orderInput());
    await instance.attempt(ID);
    expect(calls).toHaveLength(1);
    handlers.visibilitychange();
    expect(calls).toHaveLength(1); // still hidden
    doc.visibilityState = 'visible';
    handlers.visibilitychange();
    await waitFor(() => expect(calls).toHaveLength(2));
    stop();
  });

  it('starts only once per page', () => {
    const { instance } = engine([ok()]);
    instance.add(orderInput());
    const a = instance.start({ window: null, document: null });
    const b = instance.start({ window: null, document: null });
    expect(b.inherited).toEqual([]);
    a.stop();
  });
});

describe('storage that cannot be trusted', () => {
  it('ignores damaged, foreign and expired entries', () => {
    const now = 5_000_000_000;
    const good = { v: 1, ...orderInput(), createdAt: now - 1000, attempts: 0, nextAt: now, state: 'pending' };
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, JSON.stringify([
      good,
      { ...good, paypalOrderId: ID2, createdAt: now - MAX_AGE_MS - 1 }, // older than 30 days
      { ...good, paypalOrderId: 'not-a-paypal-id' },
      { ...good, path: '/admin/orders' }, // not a route the loop may call
      { ...good, v: 2 },
      'junk', null, 42,
    ]));
    expect(readRecords(store, now).map((r) => r.paypalOrderId)).toEqual([ID]);
    store.setItem(STORAGE_KEY, '{not json');
    expect(readRecords(store, now)).toEqual([]);
    store.setItem(STORAGE_KEY, '{"a":1}');
    expect(readRecords(store, now)).toEqual([]);
    expect(readRecords(null, now)).toEqual([]);
  });

  it('keeps at most twenty records', () => {
    const now = 10;
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ v: 1, ...orderInput(`ABCDEFGHIJ01234${String(i).padStart(2, '0')}`), createdAt: now, attempts: 0, nextAt: now, state: 'pending' }))));
    expect(readRecords(store, now)).toHaveLength(MAX_RECORDS);
  });

  it('when storage is blocked the page still retries from memory', async () => {
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    const calls: string[] = [];
    const instance = new PendingFulfilment({ store: throwing, post: async (path) => { calls.push(path); return calls.length === 1 ? fail(503) : ok(); } });
    instance.add(orderInput());
    expect(instance.list().map((r) => r.paypalOrderId)).toEqual([ID]);
    expect(await instance.attempt(ID)).toBe('retry');
    expect(instance.get(ID)?.attempts).toBe(1);
    expect(await instance.attempt(ID)).toBe('saved');
    expect(instance.list()).toEqual([]);
  });

  it('no storage at all (a server render) is fine', () => {
    const instance = new PendingFulfilment({ store: null, post: async () => ok() });
    instance.add(orderInput());
    expect(instance.list()).toHaveLength(1);
  });
});

describe('cartSignature', () => {
  it('is the same for the same lines in any order, and different when a quantity or colour differs', () => {
    const a = { _id: 'a'.repeat(24), color: 'red', quantity: 1 };
    const b = { _id: 'b'.repeat(24), color: '', quantity: 2 };
    expect(cartSignature([a, b])).toBe(cartSignature([b, a]));
    expect(cartSignature([a, b])).not.toBe(cartSignature([{ ...a, quantity: 2 }, b]));
    expect(cartSignature([a, b])).not.toBe(cartSignature([{ ...a, color: 'blue' }, b]));
    expect(cartSignature([])).toBe('[]');
  });
});

describe('capturing a payment survives a lost answer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const stubFetch = (replies: (Response | Error)[]) => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      const reply = replies.length > 1 ? replies.shift()! : replies[0];
      if (reply instanceof Error) throw reply;
      return reply;
    }));
    return calls;
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('asks again (the API answers COMPLETED again for a payment it already captured) before giving up', async () => {
    const calls = stubFetch([new Error('offline'), json(503, { error: 'x' }), json(200, { id: ID, status: 'COMPLETED' })]);
    const pending = captureWithRetry(ID);
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result).toMatchObject({ ok: true, data: { status: 'COMPLETED' } });
    expect(calls).toHaveLength(3);
  });

  it('gives up after three tries and says the answer was lost (not that the payment failed)', async () => {
    const calls = stubFetch([new Error('offline')]);
    const pending = captureWithRetry(ID);
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result).toMatchObject({ ok: false, status: 0 });
    expect(isLostAnswer((result as { status: number }).status)).toBe(true);
    expect(calls).toHaveLength(3);
  });

  it('a definite "not completed" (402) is not asked again', async () => {
    const calls = stubFetch([json(402, { error: 'Payment was not completed' })]);
    const result = await captureWithRetry(ID);
    expect(result).toMatchObject({ ok: false, status: 402 });
    expect(isLostAnswer(402)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- the screens

describe('useSaveAfterPayment', () => {
  afterEach(cleanup);

  const body = { firstName: 'Maria', products: [] };

  beforeEach(() => {
    localStorage.clear();
    for (const record of pendingFulfilment.list()) void pendingFulfilment.attempt(record.paypalOrderId);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const stubApi = (replies: (Response | Error)[]) => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const reply = replies.length > 1 ? replies.shift()! : replies[0];
      if (reply instanceof Error) throw reply;
      return reply;
    }));
  };

  it('saves, and reports saved when the API confirms (the record is gone)', async () => {
    stubApi([new Response('Created', { status: 201 })]);
    const { result } = renderHook(() => useSaveAfterPayment());
    let saved = false;
    await act(async () => { saved = await result.current.save('/order/newOrder', body, ID, { cart: '[]' }); });
    expect(saved).toBe(true);
    expect(result.current.status).toBe('saved');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports "retrying" when the API cannot be reached, and the order is kept in the browser (the cart is not emptied: save is false)', async () => {
    stubApi([new Error('offline')]);
    const { result } = renderHook(() => useSaveAfterPayment());
    let saved = true;
    await act(async () => { saved = await result.current.save('/order/newOrder', body, ID2, {}); });
    expect(saved).toBe(false);
    expect(result.current.status).toBe('retrying');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ paypalOrderId: ID2, path: '/order/newOrder', body });
    // the API comes back: the next attempt (the retry loop, or the next visit) saves it and the record is gone
    stubApi([new Response('Created', { status: 201 })]);
    await act(async () => { await pendingFulfilment.attempt(ID2); });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(pendingFulfilment.list()).toEqual([]);
  });

  it('reports "failed" for a refusal, and "try again" sends it once more', async () => {
    stubApi([new Response(JSON.stringify({ error: 'Bad input' }), { status: 422 }), new Response('Created', { status: 201 })]);
    const { result } = renderHook(() => useSaveAfterPayment());
    await act(async () => { await result.current.save('/order/newOrder', body, ID, {}); });
    expect(result.current.status).toBe('failed');
    await act(async () => { result.current.retry(); });
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('DonePanel after a payment', () => {
  afterEach(cleanup);

  const view = (props: Partial<Parameters<typeof DonePanel>[0]>) =>
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <DonePanel icon="check" title="Thank you" reference={ID} {...props} />
      </NextIntlClientProvider>,
    );

  it('always shows the reference number', () => {
    view({ saveStatus: 'saved' });
    expect(screen.getByText(`Payment reference: ${ID}`)).toBeInTheDocument();
  });

  it('while the record is still being saved it says the payment went through, that it keeps trying, and shows the reference and a way to write', () => {
    view({ saveStatus: 'retrying', onRetry: () => undefined });
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.getByText(/Your payment went through\. We could not save your details yet/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`payment reference \\(${ID}\\)`))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nazarethholycross@gmail.com' })).toHaveAttribute('href', 'mailto:nazarethholycross@gmail.com');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('when the API refused it for good it is an alert with the same reference and e-mail', () => {
    view({ saveStatus: 'failed', onRetry: () => undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('Your payment went through, but we could not save your details.');
    expect(screen.getByRole('link', { name: 'nazarethholycross@gmail.com' })).toBeInTheDocument();
  });

  it('says nothing about a problem when all is well', () => {
    view({ saveStatus: 'saved' });
    expect(screen.queryByText(/could not save/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
