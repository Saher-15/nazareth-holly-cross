import crypto from 'node:crypto';
import AuditLog from '../model/auditLog.js';
import { derivedKey } from './keys.js';

// The one way anything is written to the audit log:
//
//   await audit(req, 'order.update', { type: 'order', id }, { done: true });
//
// - The actor is the signed-in admin (req.adminUser); for a failed sign-in the route sets req.auditActor to the
//   name that was typed, because no account was proven.
// - The address is stored as a keyed hash (same address -> same value, so repeated attempts are visible, but the
//   address cannot be read back); the user agent as a short summary ("Chrome 126 / Windows").
// - `meta` is cleaned: secret-looking keys are dropped, values are short and plain. Passwords, tokens and TOTP
//   codes must never be passed in; the filter is a second line of defence, not the first.
// - It never throws and never blocks the request on failure (a broken audit write is logged, not shown).

const clipText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);

const SECRET_KEY = /pass|secret|token|totp|otp|code|authorization|cookie|key|hash/i;

export function cleanMeta(meta, depth = 0) {
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const out = {};
  for (const [key, value] of Object.entries(meta).slice(0, 20)) {
    if (SECRET_KEY.test(key) || key.startsWith('$') || key.includes('.')) continue;
    if (value === null || typeof value === 'boolean') out[clipText(key, 40)] = value;
    else if (typeof value === 'number') out[clipText(key, 40)] = Number.isFinite(value) ? value : null;
    else if (typeof value === 'string') out[clipText(key, 40)] = clipText(value, 200);
    else if (Array.isArray(value)) {
      out[clipText(key, 40)] = value.slice(0, 10).map((v) => (typeof v === 'object' ? null : typeof v === 'string' ? clipText(v, 100) : v));
    } else if (typeof value === 'object' && depth < 1) out[clipText(key, 40)] = cleanMeta(value, depth + 1);
  }
  return out;
}

export const hashIp = (ip) =>
  crypto.createHmac('sha256', derivedKey('audit-ip-hash-v1')).update(String(ip ?? 'unknown')).digest('hex').slice(0, 32);

const BROWSERS = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[\d.]* .*Safari/, 'Safari'],
  [/curl\/(\d+)/, 'curl'],
];
const SYSTEMS = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Macintosh|Mac OS X/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux|X11/, 'Linux'],
];

export function summarizeUserAgent(ua) {
  if (typeof ua !== 'string' || !ua) return 'Unknown';
  const browser = BROWSERS.map(([re, name]) => { const m = re.exec(ua); return m && `${name} ${m[1]}`; }).find(Boolean);
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  return clipText([browser ?? 'Other', system].filter(Boolean).join(' / '), 80);
}

function normaliseTarget(target) {
  if (!target) return { type: '', id: '' };
  if (typeof target === 'string') {
    const [type, ...rest] = target.split(':');
    return { type: clipText(type, 40), id: clipText(rest.join(':'), 64) };
  }
  return { type: clipText(target.type, 40), id: clipText(target.id, 64) };
}

export async function audit(req, action, target = null, meta = {}) {
  try {
    const actor = req.adminUser ?? req.auditActor ?? null;
    await AuditLog.create({
      at: new Date(),
      actorId: req.adminUser?.id ?? null,
      actorName: clipText(actor?.username, 100),
      role: clipText(actor?.role, 20),
      action: clipText(action, 60),
      target: normaliseTarget(target),
      meta: cleanMeta(meta),
      ipHash: hashIp(req.ip),
      ua: summarizeUserAgent(req.headers?.['user-agent']),
    });
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] audit write failed (${clipText(action, 60)}): ${err.message}`);
    return false;
  }
}
