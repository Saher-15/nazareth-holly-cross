// An in-memory stand-in for the MongoDB driver's `Db`, for testing the operations scripts (backup, restore,
// ensure-indexes, check-data, reconcile-payments) without a database. It implements exactly the few methods those
// scripts call, and behaves like MongoDB where it matters to them:
//
//   db.databaseName                       db.createCollection(name)
//   db.listCollections(filter?).toArray() -> [{ name, type: 'collection' }]
//   db.collection(name).find(filter?)     -> async-iterable cursor with toArray(); equality, $in, $ne, $exists,
//                                            $lte/$gte/$lt/$gt, $or/$and, dotted paths; ObjectIds compare by value
//   .countDocuments(filter?)  .estimatedDocumentCount()  .insertMany(docs, options?)  .insertOne(doc)
//   .indexes()                            -> index specs in the shape MongoDB reports (a missing collection throws
//                                            code 26 "ns does not exist", like the real thing)
//   .createIndex(key, options?)           -> creates the collection too; refuses an index that clashes with an
//                                            existing one (code 85/86); enforces unique indexes on later inserts
//   .dropIndex(name)
//
// Documents are stored as given (BSON values such as ObjectId and Date stay objects).

const isIdLike = (v) => v !== null && typeof v === 'object' && typeof v.toHexString === 'function';
const norm = (v) => (isIdLike(v) ? `oid:${v.toHexString()}` : v instanceof Date ? `date:${v.getTime()}` : v);
const eq = (a, b) => (b === null ? a === null || a === undefined : norm(a) === norm(b));

const getPath = (doc, path) => path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), doc);

function matchValue(value, cond) {
  const isOps = cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !isIdLike(cond) && !Array.isArray(cond)
    && Object.keys(cond).some((k) => k.startsWith('$'));
  if (!isOps) return Array.isArray(value) ? value.some((v) => eq(v, cond)) || eq(value, cond) : eq(value, cond);
  return Object.entries(cond).every(([op, arg]) => {
    switch (op) {
      case '$ne': return !eq(value, arg);
      case '$in': return arg.some((a) => eq(value, a));
      case '$exists': return (value !== undefined) === arg;
      case '$type': return arg === 'string' ? typeof value === 'string' : arg === 'number' ? typeof value === 'number' : (() => { throw new Error('fake db: unsupported $type ' + arg); })();
      case '$lt': return value != null && value < arg;
      case '$lte': return value != null && value <= arg;
      case '$gt': return value != null && value > arg;
      case '$gte': return value != null && value >= arg;
      default: throw new Error(`fake db: unsupported operator ${op}`);
    }
  });
}

const matches = (doc, filter = {}) => Object.entries(filter).every(([key, cond]) => {
  if (key === '$and') return cond.every((f) => matches(doc, f));
  if (key === '$or') return cond.some((f) => matches(doc, f));
  return matchValue(getPath(doc, key), cond);
});

const autoName = (key) => Object.entries(key).map(([f, d]) => `${f}_${d}`).join('_');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function duplicateKeyError(collection, index) {
  const error = new Error(`E11000 duplicate key error collection: ${collection} index: ${index}`);
  error.code = 11000;
  return error;
}

export function fakeDb({ name = 'nhc_test' } = {}) {
  const collections = new Map(); // name -> { docs: [], indexes: [spec] }

  const ensure = (collection) => {
    if (!collections.has(collection)) collections.set(collection, { docs: [], indexes: [{ v: 2, key: { _id: 1 }, name: '_id_' }] });
    return collections.get(collection);
  };

  const checkUnique = (collection, state, doc, ignore = null) => {
    for (const index of state.indexes) {
      if (!index.unique) continue;
      const fields = Object.keys(index.key);
      const values = fields.map((f) => getPath(doc, f));
      if (index.partialFilterExpression && !matches(doc, index.partialFilterExpression)) continue;
      if (values.every((v) => v === undefined || v === null) && index.sparse) continue;
      const clash = state.docs.some((other) => other !== ignore && other !== doc && fields.every((f, i) => eq(getPath(other, f), values[i])));
      if (clash) throw duplicateKeyError(collection, index.name);
    }
  };

  const cursorOf = (docs) => ({
    async toArray() { return docs.map((d) => d); },
    async *[Symbol.asyncIterator]() { for (const d of docs) yield d; },
  });

  const handle = (collection) => ({
    find(filter = {}) {
      const state = collections.get(collection);
      return cursorOf(state ? state.docs.filter((d) => matches(d, filter)) : []);
    },
    async countDocuments(filter = {}) { return (collections.get(collection)?.docs ?? []).filter((d) => matches(d, filter)).length; },
    async estimatedDocumentCount() { return collections.get(collection)?.docs.length ?? 0; },
    async insertOne(doc) { return this.insertMany([doc]); },
    async insertMany(docs) {
      const state = ensure(collection);
      let inserted = 0;
      for (const doc of docs) {
        checkUnique(collection, state, doc);
        if (state.docs.some((d) => eq(d._id, doc._id) && doc._id !== undefined)) throw duplicateKeyError(collection, '_id_');
        state.docs.push(doc);
        inserted += 1;
      }
      return { insertedCount: inserted };
    },
    async indexes() {
      const state = collections.get(collection);
      if (!state) {
        const error = new Error(`ns does not exist: ${name}.${collection}`);
        error.code = 26;
        throw error;
      }
      return state.indexes.map((i) => ({ ...i }));
    },
    async createIndex(key, options = {}) {
      const state = ensure(collection);
      const isText = Object.values(key).includes('text');
      const indexName = options.name ?? autoName(key);
      const { name: _n, background: _b, ...rest } = options;
      const spec = isText
        ? {
            v: 2, key: { _fts: 'text', _ftsx: 1 }, name: indexName, ...rest,
            weights: rest.weights ?? Object.fromEntries(Object.keys(key).map((f) => [f, 1])),
            default_language: rest.default_language ?? 'english', language_override: rest.language_override ?? 'language', textIndexVersion: 3,
          }
        : { v: 2, key: { ...key }, name: indexName, ...rest };
      const existing = state.indexes.find((i) => i.name === indexName || same(i.key, spec.key));
      if (existing) {
        const { v: _v1, ...a } = existing;
        const { v: _v2, ...b } = spec;
        if (same(a, b)) return indexName;
        const error = new Error(`An existing index has the same ${existing.name === indexName ? 'name' : 'key pattern'} but different options: ${existing.name}`);
        error.code = existing.name === indexName ? 86 : 85;
        throw error;
      }
      if (spec.unique) for (const doc of state.docs) checkUnique(collection, { ...state, indexes: [spec] }, doc, doc);
      state.indexes.push(spec);
      return indexName;
    },
    async dropIndex(indexName) {
      const state = collections.get(collection);
      const at = state?.indexes.findIndex((i) => i.name === indexName) ?? -1;
      if (at < 0) {
        const error = new Error(`index not found with name [${indexName}]`);
        error.code = 27;
        throw error;
      }
      state.indexes.splice(at, 1);
      return { ok: 1 };
    },
  });

  return {
    databaseName: name,
    async createCollection(collection) { ensure(collection); },
    listCollections() {
      return { async toArray() { return [...collections.keys()].map((n) => ({ name: n, type: 'collection' })); } };
    },
    collection: handle,
    // ---- test helpers ----
    seed(collection, docs) {
      const state = ensure(collection);
      state.docs.push(...docs);
      return docs;
    },
    docs(collection) { return collections.get(collection)?.docs ?? []; },
    names() { return [...collections.keys()]; },
  };
}
