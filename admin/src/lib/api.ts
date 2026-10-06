// Typed client for the admin API (see docs/ADMIN.md for the contract) plus a zod schema for every response.
//
// Schemas are deliberately tolerant about EXTRA fields (z.looseObject): the server may add fields without
// breaking the dashboard. They are strict about the fields the UI relies on, so a contract change shows up
// as one clear error ("unexpected response") instead of an undefined deep inside a component.
//
// This file works on the server and in the browser. Server code calls apiRequest() with the API origin and a
// token; the browser only ever calls the same-origin /api/proxy route (lib/client-api.ts).

import { z } from 'zod';
import { decodeDeep } from './entities';
import { ROLES } from './roles';

// ---------------------------------------------------------------- errors

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, message: string, options: { code?: string; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get unauthorized() {
    return this.status === 401;
  }
  get forbidden() {
    return this.status === 403;
  }
  get totpRequired() {
    return this.status === 428;
  }
  get rateLimited() {
    return this.status === 429;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

// ---------------------------------------------------------------- schemas

const roleSchema = z.enum(ROLES);

const isoDate = z.string().min(1);
const money = z.number().finite();

/** Mongo-style documents carry `_id`; the API may also (or only) send `id`. The UI always reads `id`. */
function doc<Shape extends z.ZodRawShape>(shape: Shape) {
  return z
    .looseObject({ _id: z.string().optional(), id: z.string().optional(), ...shape })
    .transform((value) => {
      const ids = value as { id?: string; _id?: string };
      const id: string = ids.id ?? ids._id ?? '';
      return { ...value, id };
    })
    .refine((value) => (value as { id: string }).id.length > 0, { message: 'document without an id' });
}

export const sessionUserSchema = z.looseObject({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
  totpEnabled: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const loginResponseSchema = z.looseObject({
  token: z.string().min(10),
  expiresIn: z.number().positive(),
  user: sessionUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const meSchema = z.looseObject({
  id: z.string(),
  username: z.string(),
  role: roleSchema,
  totpEnabled: z.boolean(),
  lastLoginAt: isoDate.nullable().optional(),
});
export type Me = z.infer<typeof meSchema>;

export const totpSetupSchema = z.looseObject({ secret: z.string().min(8), otpauthUrl: z.string().startsWith('otpauth://') });
export type TotpSetup = z.infer<typeof totpSetupSchema>;

export const orderLineSchema = z.looseObject({
  productID: z.string().nullish(),
  productName: z.string().nullish(),
  quantity: z.number().nullish(),
  color: z.string().nullish(),
});

export const orderSchema = doc({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().nullish(),
  street: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postal: z.string().nullish(),
  country: z.string().nullish(),
  date: isoDate.nullish(),
  createdAt: isoDate.nullish(),
  totalPrice: money,
  products: z.array(orderLineSchema).default([]),
  done: z.boolean().default(false),
  paymentVerified: z.boolean().nullish(),
  paypalOrderId: z.string().nullish(),
});
export type Order = z.infer<typeof orderSchema>;

export const candleSchema = doc({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  prayer: z.string(),
  done: z.boolean().default(false),
  createdAt: isoDate.nullish(),
});
export type Candle = z.infer<typeof candleSchema>;

export const contactSchema = doc({
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullish(),
  msg: z.string(),
  done: z.boolean().default(false),
  createdAt: isoDate.nullish(),
});
export type Contact = z.infer<typeof contactSchema>;

export const siteReviewSchema = doc({
  fullName: z.string(),
  // Where the reviewer is from (reviews written before 2026-10-06 keep it in email).
  place: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  msg: z.string(),
  approved: z.boolean().default(true),
  createdAt: isoDate.nullish(),
});
export type SiteReview = z.infer<typeof siteReviewSchema>;

export const productReviewSchema = doc({
  // populated by the API as {_id,name}; may also be a plain id
  product: z.union([z.looseObject({ _id: z.string().optional(), name: z.string().optional() }), z.string()]).nullish(),
  name: z.string(),
  country: z.string().nullish(),
  rating: z.number(),
  title: z.string().nullish(),
  comment: z.string(),
  approved: z.boolean().default(true),
  createdAt: isoDate.nullish(),
});
export type ProductReview = z.infer<typeof productReviewSchema>;

export const prayerSchema = doc({
  name: z.string(),
  country: z.string().nullish(),
  prayer: z.string(),
  category: z.string().nullish(),
  likes: z.number().nullish(),
  createdAt: isoDate.nullish(),
});
export type Prayer = z.infer<typeof prayerSchema>;

export const productSchema = doc({
  name: z.string(),
  price: money,
  img: z.string(),
  additionalImageUrls: z.array(z.string()).nullish(),
  description: z.string().nullish(),
  uuidv4_: z.string().nullish(),
  rate: z.number().nullish(),
  color: z.array(z.string()).nullish(),
  stock: z.number().nullable().optional(),
  category: z.string().nullish(),
  createdAt: isoDate.nullish(),
});
export type Product = z.infer<typeof productSchema>;

// The payment ledger (server/model/payment.js, docs/ADMIN.md "Payments"). type: order | candle | donation | unknown;
// status: created | captured | failed. linkedTo points at the order or candle request the payment paid for.
export const paymentSchema = doc({
  paypalOrderId: z.string(),
  type: z.string(),
  amount: money,
  currency: z.string().nullish(),
  status: z.string(),
  capturedAt: isoDate.nullish(),
  createdAt: isoDate.nullish(),
  payerEmail: z.string().nullish(),
  payerName: z.string().nullish(),
  donorName: z.string().nullish(),
  linkedTo: z.looseObject({ kind: z.string().nullish(), id: z.string().nullish() }).nullish(),
  resolvedAt: isoDate.nullish(),
  resolvedBy: z.string().nullish(),
  notes: z.string().nullish(),
});
export type Payment = z.infer<typeof paymentSchema>;

// POST /admin/privacy/lookup and /erase (owner): counts per collection, never the data itself.
const privacyCounts = z.looseObject({ orders: z.number(), candles: z.number(), contacts: z.number(), reviews: z.number(), payments: z.number() });
export const privacyLookupSchema = z.looseObject({ found: privacyCounts });
export const privacyEraseSchema = z.looseObject({ erased: privacyCounts });
export type PrivacyCounts = z.infer<typeof privacyCounts>;

export const userSchema = doc({
  username: z.string(),
  role: roleSchema,
  disabled: z.boolean().default(false),
  totpEnabled: z.boolean().nullish(),
  lastLoginAt: isoDate.nullish(),
  createdAt: isoDate.nullish(),
});
export type AdminUser = z.infer<typeof userSchema>;

// The API's entry: { at, actorId, actorName, role, action, target: { type, id }, meta, ipHash, ua } (docs/ADMIN.md 5.2).
// `createdAt`, `actor` (a name or {username}) and `userAgent` are still read, for older or mocked answers.
export const auditSchema = doc({
  at: isoDate.optional(),
  createdAt: isoDate.optional(),
  actor: z.union([z.string(), z.looseObject({ username: z.string().optional() })]).nullish(),
  actorName: z.string().nullish(),
  actorId: z.string().nullish(),
  role: z.string().nullish(),
  action: z.string(),
  target: z.union([z.string(), z.looseObject({ type: z.unknown().optional(), id: z.unknown().optional() })]).nullish(),
  meta: z.unknown().optional(),
  ipHash: z.string().nullish(),
  ua: z.string().nullish(),
  userAgent: z.string().nullish(),
}).transform((e) => {
  const { actor, actorName, target, ua, userAgent, ...rest } = e;
  const targetText = typeof target === 'string' ? target : target ? [target.type, target.id].filter((v) => v !== undefined && v !== null && v !== '').map(String).join(':') : '';
  return {
    ...rest,
    when: e.at ?? e.createdAt ?? '',
    actorName: actorName || (typeof actor === 'string' ? actor : (actor?.username ?? '')),
    targetText,
    userAgent: ua ?? userAgent ?? null,
  };
});
export type AuditEntry = z.infer<typeof auditSchema>;

export function pageOf<T extends z.ZodType>(item: T) {
  return z.looseObject({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    size: z.number().int().positive(),
  });
}
export type Paged<T> = { items: T[]; total: number; page: number; size: number };

export const ordersPage = pageOf(orderSchema);
export const candlesPage = pageOf(candleSchema);
export const contactsPage = pageOf(contactSchema);
export const siteReviewsPage = pageOf(siteReviewSchema);
export const productReviewsPage = pageOf(productReviewSchema);
export const prayersPage = pageOf(prayerSchema);
export const productsPage = pageOf(productSchema);
export const paymentsPage = pageOf(paymentSchema);
export const usersPage = pageOf(userSchema);
export const auditPage = pageOf(auditSchema);

export const dashboardSchema = z.looseObject({
  totals: z.looseObject({
    orders: z.number(),
    ordersPending: z.number(),
    revenue: z.number(),
    candles: z.number(),
    candlesPending: z.number(),
    contacts: z.number(),
    contactsOpen: z.number(),
    products: z.number(),
    productReviews: z.number(),
    prayers: z.number(),
    reviews: z.number(),
  }),
  last30Days: z.array(z.looseObject({ date: z.string(), orders: z.number(), revenue: z.number(), candles: z.number() })),
  topProducts: z.array(z.looseObject({ productId: z.string().nullish(), name: z.string(), sold: z.number(), revenue: z.number() })),
  lowStock: z.array(z.looseObject({ productId: z.string().nullish(), name: z.string(), stock: z.number() })),
  recent: z.looseObject({
    orders: z.array(orderSchema),
    candles: z.array(candleSchema),
    contacts: z.array(contactSchema),
  }),
  // Absent from an API that predates the payment ledger: the dashboard then simply shows no alert.
  alerts: z.looseObject({ unfulfilledPayments: z.looseObject({ count: z.number(), amount: z.number() }) }).optional(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const errorBodySchema = z.looseObject({ error: z.string() });

// ---------------------------------------------------------------- request helper

export type Query = Record<string, string | number | boolean | undefined | null>;

export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export type RequestOptions<T> = {
  /** Origin of the API (server) or '' for same-origin calls (browser). */
  base: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  query?: Query;
  schema?: z.ZodType<T>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

function retryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined;
}

export async function apiRequest<T = void>(options: RequestOptions<T>): Promise<T> {
  const { base, path, method = 'GET', token, body, query, schema, headers = {}, timeoutMs = 10_000, signal } = options;
  const init: RequestInit = {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    redirect: 'error',
    signal: signal ?? AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res: Response;
  try {
    res = await fetch(`${base}${path}${buildQuery(query)}`, init);
  } catch (cause) {
    const timedOut = cause instanceof DOMException && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
    throw new ApiError(timedOut ? 504 : 502, timedOut ? 'The server took too long to answer.' : 'The server cannot be reached.', {
      code: timedOut ? 'timeout' : 'network',
    });
  }

  if (res.status === 204) return undefined as T;

  const type = res.headers.get('content-type') ?? '';
  let payload: unknown = undefined;
  if (type.includes('json')) {
    try {
      payload = await res.json();
    } catch {
      throw new ApiError(502, 'The server sent an unreadable answer.', { code: 'bad_json' });
    }
  }

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(payload);
    const message = parsed.success ? parsed.data.error : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, { code: parsed.success ? parsed.data.error : undefined, retryAfterSeconds: retryAfter(res) });
  }

  if (!schema) return payload as T;
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(502, 'The server sent an unexpected answer.', { code: 'bad_shape' });
  }
  return decodeDeep(result.data); // stored text arrives HTML-escaped (docs/ADMIN.md 4.2)
}

/** Page parameters shared by every list screen; parsed from the URL, so a bad value never reaches the API. */
export type ListParams = { page: number; size: number; q: string; status: string; sort: string };

export function parseListParams(raw: Record<string, string | string[] | undefined>, defaults: Partial<ListParams> = {}): ListParams {
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(one('page') ?? '', 10);
  const size = Number.parseInt(one('size') ?? '', 10);
  return {
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : (defaults.page ?? 1),
    size: [10, 25, 50, 100].includes(size) ? size : (defaults.size ?? 25),
    q: (one('q') ?? '').slice(0, 100),
    status: /^[a-z_-]{0,20}$/i.test(one('status') ?? '') ? (one('status') ?? '') : '',
    sort: /^-?[a-zA-Z_]{0,30}$/.test(one('sort') ?? '') ? (one('sort') ?? '') : (defaults.sort ?? ''),
  };
}
