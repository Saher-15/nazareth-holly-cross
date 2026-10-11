// The audit log in words (review 04 finding 13): what an entry's action code means ("order.update" with done: true is
// "Marked an order shipped"), a few facts from its meta ("e-mail sent", "role: Editor"), what the target is ("Order
// #0000003f", "User staff") and where it can be opened. The raw code stays visible next to the words, for precision.
// The API names the target when it can (targetName: a username, a product's name, an order's number).

import type { MessageKey } from '@/i18n/messages/en';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
type Entry = { action: string; meta?: unknown; targetType?: string; targetId?: string; targetName?: string | null };

const meta = (entry: Entry): Record<string, unknown> => (entry.meta && typeof entry.meta === 'object' ? (entry.meta as Record<string, unknown>) : {});

/** Actions with a fixed label. */
const FIXED: Record<string, MessageKey> = {
  'auth.login': 'audit.a.login',
  'auth.login_failed': 'audit.a.loginFailed',
  'auth.logout': 'audit.a.logout',
  'auth.account_locked': 'audit.a.locked',
  'auth.password_change': 'audit.a.passwordChange',
  'auth.password_change_failed': 'audit.a.passwordChangeFailed',
  'auth.password_reset_requested': 'audit.a.resetRequested',
  'auth.password_reset': 'audit.a.reset',
  'auth.owner_bootstrap': 'audit.a.bootstrap',
  'auth.totp_setup': 'audit.a.totpSetup',
  'auth.totp_enable': 'audit.a.totpOn',
  'auth.totp_disable': 'audit.a.totpOff',
  'order.delete': 'audit.a.orderDelete',
  'product.create': 'audit.a.productCreate',
  'product.update': 'audit.a.productUpdate',
  'product.delete': 'audit.a.productDelete',
  'user.create': 'audit.a.userCreate',
  'user.update': 'audit.a.userUpdate',
  'user.delete': 'audit.a.userDelete',
  'privacy.lookup': 'audit.a.privacyLookup',
  'privacy.erase': 'audit.a.privacyErase',
  'live.start': 'audit.a.liveStart',
  'live.stop': 'audit.a.liveStop',
  'live.auto_end': 'audit.a.liveAutoEnd',
};

/** The action in words, or null when there is no label for it (the code is shown then). */
export function auditLabel(entry: Entry, t: Translate): string | null {
  const m = meta(entry);
  const fixed = FIXED[entry.action];
  if (fixed) return t(fixed);
  const [type, verb] = entry.action.split('.');
  if (type === 'order' && verb === 'update') return t(m.done === false ? 'audit.a.orderUnshipped' : 'audit.a.orderShipped');
  if ((type === 'candle' || type === 'contact') && verb === 'update') return t(m.done === false ? 'audit.a.undone' : 'audit.a.done');
  if ((type === 'site-review' || type === 'product-review') && verb === 'update') return t(m.approved === false ? 'audit.a.reviewHide' : 'audit.a.reviewShow');
  if (verb === 'delete' && ['candle', 'contact', 'site-review', 'product-review', 'prayer'].includes(type)) return t('audit.a.delete');
  if (type === 'export') return t('audit.a.export');
  if (type === 'payment' && verb === 'update') return t(m.resolved === false ? 'audit.a.paymentReopen' : 'audit.a.paymentResolve');
  return null;
}

const FIELD_KEYS: Record<string, MessageKey> = {
  name: 'products.name', price: 'products.price', stock: 'products.stock', category: 'products.category', rate: 'products.rate',
  color: 'products.colors', description: 'products.description', img: 'products.mainImage', additionalImageUrls: 'products.sectionImages',
};

/** A few facts from the entry's meta, in words. */
export function auditDetails(entry: Entry, t: Translate): string[] {
  const m = meta(entry);
  const out: string[] = [];
  if (entry.action === 'order.update' && m.done !== false) {
    if (m.emailSent === true) out.push(t('audit.d.emailSent'));
    else if (m.emailSent === false) out.push(t('audit.d.emailFailed'));
  }
  if (entry.action === 'product.update' && Array.isArray(m.fields)) {
    out.push(t('audit.d.changed', { fields: m.fields.map((f) => (typeof f === 'string' && FIELD_KEYS[f] ? t(FIELD_KEYS[f]) : String(f))).join(', ') }));
  }
  if (entry.action.startsWith('user.')) {
    if (typeof m.role === 'string' && ['owner', 'editor', 'viewer'].includes(m.role)) out.push(t('audit.d.role', { role: t(`role.${m.role as 'owner'}`) }));
    if (m.disabled === true) out.push(t('audit.d.disabled'));
    if (m.disabled === false) out.push(t('audit.d.enabled'));
    if (m.resetTotp === true) out.push(t('audit.d.totpReset'));
    if (m.unlock === true) out.push(t('audit.d.unlocked'));
    // server/route/admin/users.js: `email: 'set' | 'removed'` on a change, `hasEmail` on creation
    if (m.email === 'set' || m.email === 'changed' || (entry.action === 'user.create' && (m.hasEmail === true || m.email === true))) out.push(t('audit.d.emailSet'));
    if (m.email === 'removed') out.push(t('audit.d.emailRemoved'));
  }
  if (entry.action.startsWith('export.') && typeof m.rows === 'number') out.push(t('audit.d.rows', { n: m.rows }));
  if (entry.action === 'auth.login_failed' && typeof m.reason === 'string') {
    const reasons: Record<string, MessageKey> = { wrong_password: 'audit.d.wrongPassword', unknown_user: 'audit.d.unknownUser', locked: 'audit.d.whileLocked', wrong_totp: 'audit.d.wrongCode', disabled: 'audit.d.disabledAccount' };
    out.push(reasons[m.reason] ? t(reasons[m.reason]) : m.reason);
  }
  return out;
}

const TYPE_KEYS: Record<string, MessageKey> = {
  order: 'audit.t.order', candle: 'audit.t.candle', contact: 'audit.t.contact', product: 'audit.t.product', user: 'audit.t.user',
  payment: 'audit.t.payment', 'site-review': 'audit.t.siteReview', 'product-review': 'audit.t.productReview', prayer: 'audit.t.prayer',
  admin: 'audit.t.user', orders: 'audit.t.orders', candles: 'audit.t.candles', contacts: 'audit.t.contacts', payments: 'audit.t.payments',
};

/** What the entry is about, in words ("Order #0000003f", "User staff"), or null. */
export function auditTarget(entry: Entry, t: Translate): string | null {
  const type = entry.targetType ?? '';
  const kind = TYPE_KEYS[type] ? t(TYPE_KEYS[type]) : null;
  const name = entry.targetName ?? (entry.targetId ? `#${entry.targetId.slice(-8)}` : '');
  if (!kind) return null;
  return name ? `${kind} ${name}` : kind;
}

/** Where the target can be opened in the dashboard (only records that still have a page), or null. */
export function auditHref(entry: Entry): string | null {
  const id = entry.targetId ?? '';
  if (!/^[a-f0-9]{24}$/i.test(id) || entry.action.endsWith('.delete')) return null;
  switch (entry.targetType) {
    case 'order': return `/orders?open=${id}`;
    case 'candle': return `/candles?open=${id}`;
    case 'contact': return `/contacts?open=${id}`;
    case 'payment': return `/payments?open=${id}`;
    case 'product': return `/products/${id}`;
    case 'user': return entry.targetName ? `/users?q=${encodeURIComponent(entry.targetName)}` : null;
    default: return null;
  }
}

/** The action prefixes the filter offers (the API filters by a prefix ending in a dot). */
export const AUDIT_GROUPS = ['auth.', 'order.', 'payment.', 'candle.', 'contact.', 'product.', 'site-review.', 'product-review.', 'prayer.', 'user.', 'export.', 'privacy.', 'live.', 'candle_video.', 'settings.'] as const;
