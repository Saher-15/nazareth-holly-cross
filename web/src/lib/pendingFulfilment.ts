import { postJson, type PostResult } from './apiClient';

// "Pending fulfilment": a customer has PAID (PayPal said COMPLETED) but the shop's own record of the order or the
// candle request has not been saved yet. The browser writes a record to localStorage the moment PayPal confirms the
// payment, BEFORE it calls the API, and keeps trying until the API confirms (/order/newOrder, /candle/lightACandle).
// Only then is the record removed. So a lost connection, a closed tab or a sleeping API never leaves a paid
// customer without an order: the work is retried automatically with a growing delay, and again on the next visit
// to the site from the same browser.
//
// The API side of the same promise is the payment ledger (server/model/payment.js): even if this browser never
// comes back, the payment is recorded there and appears in the admin dashboard as "paid, not fulfilled".
//
// The record holds what the API needs to save the order (name, address, products...): personal data, kept in this
// browser only until the order is confirmed saved, and for at most 30 days (docs/SECURITY.md).

export type PendingKind = 'order' | 'candle';
export type PendingPath = '/order/newOrder' | '/candle/lightACandle';

export type PendingRecord = {
  v: 1;
  /** PayPal's id of the payment: the proof of payment and the customer's reference number. */
  paypalOrderId: string;
  kind: PendingKind;
  path: PendingPath;
  /** The body the API needs, without the payment id. */
  body: Record<string, unknown>;
  /** Orders only: a signature of the cart lines that were paid for, so the cart is emptied when the order is saved. */
  cart?: string;
  createdAt: number;
  attempts: number;
  /** When the next automatic attempt is due (ms since the epoch). */
  nextAt: number;
  /** "rejected": the API refused it for good (a person must look at it). It is kept, but not retried. */
  state: 'pending' | 'rejected';
  lastStatus?: number;
};

export const STORAGE_KEY = 'nhc.pending-fulfilment.v1';
export const MAX_RECORDS = 20;
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Time between attempts: 2 s, 5 s, 15 s, 45 s, 2 min, 5 min, then every 15 min. */
export const BACKOFF_MS = [2_000, 5_000, 15_000, 45_000, 120_000, 300_000, 900_000] as const;

export const retryDelay = (attempts: number) => BACKOFF_MS[Math.min(Math.max(attempts, 1) - 1, BACKOFF_MS.length - 1)];

export type Outcome = 'saved' | 'retry' | 'rejected';

// What the API's answer means for a record.
//   saved     the API has the order / candle: 2xx, or 409 "already used" (this payment was saved by an earlier attempt
//             whose answer got lost, which is exactly what a retry looks like)
//   retry     nothing is wrong with the request, the API (or the network) is: no answer, 408, 429, 5xx, and 402
//             (PayPal not yet showing the payment as completed to the API: it can lag behind by a moment)
//   rejected  the API understood and refused: 400/413/422 (bad data), 401/403/404, and a 409 that is not "already used"
//             (not enough stock): retrying cannot help, a person has to
export function classify(result: PostResult<unknown>): Outcome {
  if (result.ok) return 'saved';
  const { status, error } = result;
  if (status === 409) return /already (used|exists)/i.test(error) ? 'saved' : 'rejected';
  if (status === 0 || status === 408 || status === 425 || status === 429 || status === 402 || status >= 500) return 'retry';
  return 'rejected';
}

/** The lines of a cart as one comparable text (product, colour and quantity, in a fixed order). */
export const cartSignature = (lines: readonly { _id: string; color?: string; quantity: number }[]) =>
  JSON.stringify(lines.map((l) => [l._id, l.color ?? '', l.quantity]).sort());

// ---------------------------------------------------------------- storage

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const valid = (value: unknown): value is PendingRecord => {
  const r = value as Partial<PendingRecord> | null;
  return (
    !!r &&
    r.v === 1 &&
    typeof r.paypalOrderId === 'string' &&
    /^[A-Za-z0-9]{10,40}$/.test(r.paypalOrderId) && // PayPal issues 17 upper-case characters; the API (isPayPalOrderId) is the strict judge
    (r.kind === 'order' || r.kind === 'candle') &&
    (r.path === '/order/newOrder' || r.path === '/candle/lightACandle') &&
    typeof r.body === 'object' &&
    r.body !== null &&
    typeof r.createdAt === 'number' &&
    typeof r.attempts === 'number' &&
    typeof r.nextAt === 'number' &&
    (r.state === 'pending' || r.state === 'rejected')
  );
};

/** The records in a browser store. Unreadable, damaged and older-than-30-days entries are ignored (and dropped on the next write). */
export function readRecords(store: KeyValueStore | null, now: number): PendingRecord[] {
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
    return (Array.isArray(parsed) ? parsed : []).filter(valid).filter((r) => now - r.createdAt < MAX_AGE_MS).slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

function writeRecords(store: KeyValueStore | null, records: PendingRecord[]): boolean {
  if (!store) return false;
  try {
    if (records.length === 0) store.removeItem(STORAGE_KEY);
    else store.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
    return true;
  } catch {
    return false; // private mode, quota, blocked: the in-memory copy still retries in this tab
  }
}

// ---------------------------------------------------------------- the engine

export type PendingEvent = { type: Outcome | 'added'; record: PendingRecord };
type Listener = (event: PendingEvent) => void;

type Options = {
  store?: KeyValueStore | null;
  post?: (path: string, body: unknown) => Promise<PostResult<unknown>>;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

type Wakeable = { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void };
type Environment = { window?: Wakeable | null; document?: (Wakeable & { visibilityState?: string }) | null };
const defaultEnvironment = (): Environment => (typeof window === 'undefined' ? {} : { window, document });

const browserStore = (): KeyValueStore | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // reading localStorage can throw (blocked site data)
  }
};

export class PendingFulfilment {
  private readonly store: KeyValueStore | null;
  private readonly post: NonNullable<Options['post']>;
  private readonly now: () => number;
  private readonly setTimer: NonNullable<Options['setTimer']>;
  private readonly clearTimer: NonNullable<Options['clearTimer']>;
  private readonly listeners = new Set<Listener>();
  private readonly busy = new Set<string>();
  private memory = new Map<string, PendingRecord>(); // what this tab holds even when storage is unavailable
  private timer: unknown = null;
  private started = false;

  constructor(options: Options = {}) {
    this.store = options.store === undefined ? browserStore() : options.store;
    this.post = options.post ?? ((path, body) => postJson(path, body));
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  /** Every record: what storage holds (other tabs included) plus what this tab holds. */
  list(): PendingRecord[] {
    const byId = new Map<string, PendingRecord>();
    for (const record of readRecords(this.store, this.now())) byId.set(record.paypalOrderId, record);
    for (const [id, record] of this.memory) if (!byId.has(id)) byId.set(id, record);
    return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  get(paypalOrderId: string): PendingRecord | undefined {
    return this.list().find((r) => r.paypalOrderId === paypalOrderId);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: PendingEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private save(records: PendingRecord[]) {
    this.memory = new Map(records.map((r) => [r.paypalOrderId, r]));
    writeRecords(this.store, records);
  }

  /** Writes the record. Call this FIRST, before any request: it is what makes a closed tab survivable. */
  add(input: Pick<PendingRecord, 'paypalOrderId' | 'kind' | 'path' | 'body' | 'cart'>): PendingRecord {
    const now = this.now();
    const record: PendingRecord = { v: 1, ...input, createdAt: now, attempts: 0, nextAt: now, state: 'pending' };
    this.save([...this.list().filter((r) => r.paypalOrderId !== record.paypalOrderId), record]);
    this.emit({ type: 'added', record });
    return record;
  }

  private remove(paypalOrderId: string) {
    this.save(this.list().filter((r) => r.paypalOrderId !== paypalOrderId));
  }

  /**
   * One attempt to save a record with the API. Never throws. `force` also tries a record the API refused before
   * (the customer pressed "try again"). A record already being sent is not sent twice.
   */
  async attempt(paypalOrderId: string, { force = false } = {}): Promise<Outcome | 'busy' | 'none'> {
    if (this.busy.has(paypalOrderId)) return 'busy';
    const record = this.get(paypalOrderId);
    if (!record) return 'none';
    if (record.state === 'rejected' && !force) return 'rejected';

    this.busy.add(paypalOrderId);
    try {
      const result = await this.post(record.path, { ...record.body, paypalOrderId: record.paypalOrderId });
      const outcome = classify(result);
      if (outcome === 'saved') {
        this.remove(paypalOrderId);
        this.emit({ type: 'saved', record });
        return 'saved';
      }
      const attempts = record.attempts + 1;
      const updated: PendingRecord = {
        ...record,
        attempts,
        lastStatus: result.ok ? undefined : result.status,
        state: outcome === 'rejected' ? 'rejected' : 'pending',
        nextAt: this.now() + retryDelay(attempts),
      };
      this.save([...this.list().filter((r) => r.paypalOrderId !== paypalOrderId), updated]);
      this.emit({ type: outcome, record: updated });
      return outcome;
    } finally {
      this.busy.delete(paypalOrderId);
    }
  }

  /** Attempts every record that is due (and not refused for good). */
  async runDue(): Promise<void> {
    const now = this.now();
    for (const record of this.list()) {
      if (record.state === 'pending' && record.nextAt <= now) {
        await this.attempt(record.paypalOrderId);
      }
    }
  }

  private schedule() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const due = this.list().filter((r) => r.state === 'pending').map((r) => r.nextAt);
    if (due.length === 0 || !this.started) return;
    const wait = Math.max(500, Math.min(...due) - this.now());
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.runDue().then(() => this.schedule());
    }, wait);
  }

  /**
   * Starts the retry loop for this page: attempts every waiting record at once (those left by an earlier visit included), keeps
   * going with the backoff while the page is open, and tries again when the connection comes back or the tab is
   * shown again. Returns the ids that were already waiting when it started (a previous visit's payments) and a stop().
   */
  start(env: Environment = defaultEnvironment()) {
    if (this.started) return { inherited: [] as string[], stop: () => undefined };
    this.started = true;
    const inherited = this.list().map((r) => r.paypalOrderId);
    const wake = () => {
      // The delay is for a failing API; a new connection or a returning visitor is a reason to try at once.
      this.save(this.list().map((r) => (r.state === 'pending' ? { ...r, nextAt: Math.min(r.nextAt, this.now()) } : r)));
      void this.runDue().then(() => this.schedule());
    };
    const onVisible = () => {
      if (env.document?.visibilityState === 'visible') wake();
    };
    env.window?.addEventListener('online', wake);
    env.document?.addEventListener('visibilitychange', onVisible);
    wake(); // a new page load is a returning visitor: every waiting record is tried now, whatever its delay
    // A new record or a failed attempt changes when the next one is due.
    const unsubscribe = this.subscribe((event) => {
      if (event.type === 'added' || event.type === 'retry') this.schedule();
    });
    return {
      inherited,
      stop: () => {
        this.started = false;
        unsubscribe();
        if (this.timer !== null) this.clearTimer(this.timer);
        this.timer = null;
        env.window?.removeEventListener('online', wake);
        env.document?.removeEventListener('visibilitychange', onVisible);
      },
    };
  }
}

/** The one engine of the page. */
export const pendingFulfilment = new PendingFulfilment();
