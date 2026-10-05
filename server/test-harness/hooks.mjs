// Module hooks (node:module registerHooks) that turn the real server code into a self-contained harness:
//
//   server/model/*.js                -> the in-memory fakes of harness-models.js (no MongoDB)
//   server/services/emailService.js  -> a recorder (no SMTP): mail goes to state.emails
//   server/services/paypalService.js -> a stub that refuses (no PayPal calls)
//   dotenv                           -> a no-op, so a server/.env with real secrets is NEVER read
//   express-rate-limit               -> the real library, but every limiter gets a store the harness can reset
//
// Everything else (app.js, routes, middleware, services, validators) is the real code, unchanged.
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');
const modelDir = path.join(serverDir, 'model');
const modelsUrl = pathToFileURL(path.join(here, 'harness-models.js')).href;
const toUrl = (...parts) => pathToFileURL(path.join(serverDir, ...parts)).href;

const MODEL_KEYS = {
  order: 'Order', candle: 'Candle', contact: 'Contact', review: 'Review', productReview: 'ProductReview',
  prayer: 'Prayer', product: 'Product', admin: 'Admin', adminSession: 'AdminSession', auditLog: 'AuditLog',
};

const EMAIL_URL = toUrl('services', 'emailService.js');
const PAYPAL_URL = toUrl('services', 'paypalService.js');
const DOTENV = 'harness:dotenv';
const RATE_LIMIT = 'harness:express-rate-limit';
let realRateLimitUrl = null;

const sources = {
  [DOTENV]: 'export const config = () => ({ parsed: {} }); export default { config };',
  [EMAIL_URL]: `
    import { state } from ${JSON.stringify(modelsUrl)};
    export const SENDER = { name: 'Nazareth Holy Cross', address: 'harness@example.invalid' };
    // Records the message instead of sending it. state.failMail = true makes it behave like an SMTP failure.
    export async function sendMail(message) {
      if (state.failMail) return false;
      state.emails.push({ at: new Date().toISOString(), to: [].concat(message.to ?? []), subject: message.subject ?? '', text: message.text ?? '', html: message.html ?? '' });
      return true;
    }`,
  [PAYPAL_URL]: `
    import { HttpError } from '../utils/httpError.js';
    const refuse = async () => { throw new HttpError(503, 'PayPal is not available in the local harness'); };
    export const clearAccessTokenCache = () => {};
    export const getAccessToken = refuse;
    export const createOrder = refuse;
    export const captureOrder = refuse;
    export const getOrder = refuse;
    export const assertPaid = refuse;`,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'dotenv') return { url: DOTENV, shortCircuit: true, format: 'module' };
    if (specifier === 'express-rate-limit' && !String(context.parentURL).startsWith('harness:')) {
      realRateLimitUrl ??= nextResolve(specifier, context).url;
      return { url: RATE_LIMIT, shortCircuit: true, format: 'module' };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === RATE_LIMIT) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          import * as real from ${JSON.stringify(realRateLimitUrl)};
          import { state } from ${JSON.stringify(modelsUrl)};
          export const MemoryStore = real.MemoryStore;
          export default function rateLimit(options = {}) {
            const store = new real.MemoryStore();
            state.rateLimitStores.push(store);
            return real.default({ ...options, store });
          }`,
      };
    }
    if (sources[url]) return { format: 'module', shortCircuit: true, source: sources[url] };
    if (url.startsWith('file:')) {
      const file = fileURLToPath(url);
      if (path.dirname(file) === modelDir && path.extname(file) === '.js') {
        const key = MODEL_KEYS[path.basename(file, '.js')];
        if (key) {
          return {
            format: 'module',
            shortCircuit: true,
            source: `
              import { models, PRAYER_CATEGORIES } from ${JSON.stringify(modelsUrl)};
              export { PRAYER_CATEGORIES };
              export const AUDIT_RETENTION_DAYS = 180;
              export default models.${key};`,
          };
        }
      }
    }
    return nextLoad(url, context);
  },
});
