import Admin from '../model/admin.js';
import AdminSession from '../model/adminSession.js';
import AuditLog from '../model/auditLog.js';
import Candle from '../model/candle.js';
import Contact from '../model/contact.js';
import LiveRecording from '../model/liveRecording.js';
import LiveSession from '../model/liveSession.js';
import Order from '../model/order.js';
import Payment from '../model/payment.js';
import Prayer from '../model/prayer.js';
import Product from '../model/product.js';
import ProductReview from '../model/productReview.js';
import Review from '../model/review.js';
import ScheduledBroadcast from '../model/scheduledBroadcast.js';

// Index bookkeeping shared by scripts/ensure-indexes.js, scripts/backup.js (the manifest records the indexes) and
// the start-up check (index.js). The indexes the code needs are DECLARED IN THE MODELS (`schema.index(...)`); this
// file compares them with what a database really has and says what is missing or different.
//
// Nothing here creates or drops anything: scripts/ensure-indexes.js does, only when told to (--apply).

// Every model, in one list. The collection names come from the models (note the two that are not singular:
// `admins` and `prayers`, see docs/DATABASE.md).
export const MODELS = { Admin, AdminSession, AuditLog, Candle, Contact, LiveRecording, LiveSession, Order, Payment, Prayer, Product, ProductReview, Review, ScheduledBroadcast };

export const collectionNameOf = (Model) => Model.collection.name;

// The options of an index that change what it does (a different value means a different index).
const OPTION_KEYS = ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression', 'collation', 'weights', 'default_language', 'language_override'];
const IGNORED = new Set(['v', 'key', 'name', 'ns', 'background', 'textIndexVersion', '_fts', '_ftsx']);

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  return value;
};

// MongoDB names an index by its keys: { name: 'text', description: 'text' } -> "name_text_description_text".
export const autoName = (key) => Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join('_');

// What the models declare: [{ name, key, options }] for one model. `key` keeps its field order (it matters).
export function declaredIndexes(Model) {
  return Model.schema.indexes().map(([key, options = {}]) => {
    const kept = {};
    for (const [option, value] of Object.entries(options)) if (!IGNORED.has(option) || option === 'name') kept[option] = value;
    const { name, ...rest } = kept;
    return { name: name ?? autoName(key), key: { ...key }, options: rest };
  });
}

// What MongoDB reports (`collection.indexes()`), brought to the same shape. A text index is reported with the
// internal keys { _fts: 'text', _ftsx: 1 } and a `weights` map: the field list is rebuilt from the weights.
export function normaliseActual(spec) {
  let key = { ...spec.key };
  if (key._fts === 'text' && spec.weights) key = Object.fromEntries(Object.keys(spec.weights).map((field) => [field, 'text']));
  const options = {};
  for (const [option, value] of Object.entries(spec)) if (!IGNORED.has(option)) options[option] = value;
  return { name: spec.name, key, options };
}

// A text index declared without explicit weights gets weight 1 for each field; normalise the same way.
function signature({ key, options }) {
  const isText = Object.values(key).includes('text');
  const kept = {};
  for (const option of OPTION_KEYS) {
    let value = options[option];
    if (option === 'weights' && isText && value === undefined) value = Object.fromEntries(Object.keys(key).map((field) => [field, 1]));
    if (option === 'default_language' && isText && value === undefined) value = 'english';
    if (option === 'language_override' && isText && value === undefined) value = 'language';
    if (option === 'unique' || option === 'sparse') value = value === true;
    if (value !== undefined && value !== false) kept[option] = value;
  }
  // The fields of a text index have no order (MongoDB reports them alphabetically, from the weights), so they are
  // compared sorted; any other field keeps its position.
  const entries = Object.entries(key);
  const keyed = isText
    ? [...entries.filter(([, v]) => v !== 'text'), ...entries.filter(([, v]) => v === 'text').sort(([a], [b]) => a.localeCompare(b))]
    : entries;
  return JSON.stringify([keyed, sortKeys(kept)]);
}

export const sameIndex = (a, b) => signature(a) === signature(b);

// Compares one collection. `actual` is `collection.indexes()` (or [] when the collection does not exist yet).
//   missing   declared, not present                                  -> would be created
//   conflict  present under the same name or keys with other options -> must be dropped, then created again
//   extra     present, not declared by any model                     -> reported; only dropped with an explicit flag
export function diffIndexes(declared, actual) {
  const have = actual.map(normaliseActual).filter((i) => i.name !== '_id_');
  const missing = [];
  const conflict = [];
  const matched = new Set();

  for (const want of declared) {
    const exact = have.find((h) => sameIndex(h, want));
    if (exact) { matched.add(exact.name); continue; }
    const clash = have.find((h) => h.name === want.name || JSON.stringify(Object.entries(h.key)) === JSON.stringify(Object.entries(want.key)));
    if (clash) {
      matched.add(clash.name);
      conflict.push({ existing: clash, wanted: want });
    } else {
      missing.push(want);
    }
  }
  const extra = have.filter((h) => !matched.has(h.name));
  return { missing, conflict, extra };
}

// Reads the indexes of a collection; a collection that does not exist yet simply has none.
export async function actualIndexes(db, name) {
  try {
    return await db.collection(name).indexes();
  } catch (error) {
    if (error?.code === 26 || /ns does not exist|NamespaceNotFound/i.test(String(error?.message))) return [];
    throw error;
  }
}

// The plan for every model: [{ model, collection, missing, conflict, extra }].
export async function planIndexes(db, models = MODELS) {
  const plan = [];
  for (const [model, Model] of Object.entries(models)) {
    const collection = collectionNameOf(Model);
    const diff = diffIndexes(declaredIndexes(Model), await actualIndexes(db, collection));
    plan.push({ model, collection, ...diff });
  }
  return plan;
}

// The options to pass to createIndex for a declared (or recorded) index: its name and the options that matter.
export function createOptions({ name, options }) {
  const out = { name };
  for (const [option, value] of Object.entries(options)) if (!IGNORED.has(option)) out[option] = value;
  return out;
}

export const problemsIn = (plan) => plan.flatMap((p) => [
  ...p.missing.map((i) => ({ collection: p.collection, kind: 'missing', index: i.name })),
  ...p.conflict.map((c) => ({ collection: p.collection, kind: 'conflict', index: c.wanted.name })),
]);
