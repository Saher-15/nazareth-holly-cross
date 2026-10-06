// The ten Mongoose models as in-memory fakes, plus the harness state (recorded e-mails, rate-limit stores).
// Loaded by the module hooks in hooks.mjs: `import Order from '../model/order.js'` anywhere in the server resolves
// to models.Order here, so the REAL routes, services and middleware run against memory instead of MongoDB.
import bcrypt from 'bcryptjs';
import { fakeModule, fakes } from './fake-models.js';
import { runPipeline } from './aggregate.js';

// Same list as model/prayer.js (importing that file here would load the fake again).
export const PRAYER_CATEGORIES = ['Peace', 'Health', 'Gratitude', 'Family', 'Personal', 'World Peace'];

const hashCost12 = (password) => bcrypt.hashSync(password, 12);

export const models = {};
const take = (name, options) => { models[name] = fakeModule(name, options).default; return models[name]; };

take('Order', { collection: 'order', timestamps: true, unique: ['paypalOrderId'], defaults: { done: false, paymentVerified: false } });
take('Payment', { collection: 'payment', timestamps: true, unique: ['paypalOrderId'], defaults: { currency: 'USD', status: 'created', capturedAt: null, resolvedAt: null } });
take('Candle', { collection: 'candle', timestamps: true, defaults: { done: false } });
take('Contact', { collection: 'contact', timestamps: true, defaults: { done: false, phone: '' } });
take('Review', { collection: 'review', timestamps: true, defaults: { approved: true, email: '', phone: '000' } });
take('ProductReview', {
  collection: 'productReview', timestamps: true, hidden: ['ipHash'], populateRefs: { product: 'Product' },
  defaults: { approved: true, country: '', title: '' },
});
take('Prayer', {
  collection: 'prayer', timestamps: true, defaults: { category: 'Personal', likes: 0 },
  statics: { schema: { path: (p) => (p === 'category' ? { enumValues: PRAYER_CATEGORIES } : undefined) } },
});
take('Product', { collection: 'product', timestamps: true, defaults: { rate: 1, stock: null, additionalImageUrls: [], color: [] } });
take('AdminSession', { collection: 'adminSession', defaults: { revokedAt: null } });
take('AuditLog', { collection: 'auditLog', autoCreatedAt: false, defaults: { actorId: null, actorName: '', role: '', meta: {}, ipHash: '', ua: '' } });
take('Admin', {
  collection: 'admins',
  timestamps: true,
  hidden: ['totpSecretEnc'],
  defaults: { role: 'owner', disabled: false, failedLogins: 0, lockedUntil: null, totpEnabled: false, totpSecretEnc: null, totpLastStep: -1, lastLoginAt: null },
  methods: { comparePassword(password) { return bcrypt.compare(password, this.password); } },
  // Plain passwords are hashed on save (cost 12, like the real model) unless the caller marked them hashed.
  onSave: async (doc) => { if (!doc.$locals.passwordHashed && !String(doc.password).startsWith('$2')) doc.password = hashCost12(doc.password); },
});

// $lookup resolves a collection name to its documents.
const byCollection = (name) => Object.values(models).find((M) => M.collection?.name === name)?.docs ?? [];
for (const Model of Object.values(models)) {
  Model.aggregateImpl = (pipeline) => runPipeline(Model.docs, pipeline, byCollection);
}

export { fakes };

// ---- state shared with the module hooks and the control routes ----

export const state = {
  emails: [], // what the fake mailer was asked to send
  rateLimitStores: [], // every express-rate-limit MemoryStore created by the server (hooks.mjs)
};

export function clearData() {
  for (const Model of Object.values(models)) Model.resetData();
  state.emails.length = 0;
  for (const store of state.rateLimitStores) store.resetAll();
}
