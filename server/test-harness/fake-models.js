import bcrypt from 'bcryptjs';

// A small in-memory stand-in for Mongoose models, so the admin API can be driven through HTTP without a database.
// It understands what the admin routes use: find / findOne / findById (+ sort skip limit select populate lean),
// countDocuments, exists, create / new + save, insertMany, findByIdAndUpdate, findOneAndUpdate (also with
// { upsert: true } and $setOnInsert), updateOne, updateMany, findByIdAndDelete, deleteOne, deleteMany, aggregate (answers come from Model.aggregateImpl), and the filter operators
// $and $or $ne $lt $lte $gt $gte $in $exists $regex/$options. Every query is recorded in Model.calls.
//
// Use in a test file:
//   vi.mock('../model/order.js', async () => (await import('./helpers/fakes.js')).fakeModule('Order'));
//   import { fakes } from './helpers/fakes.js';   // fakes.Order.seed([...]), fakes.Order.calls, ...

export const fakes = {};

let counter = 0;
export const oid = () => (++counter).toString(16).padStart(24, '0');

const getPath = (doc, path) => path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), doc);

const same = (a, b) => {
  if (b === null) return a === null || a === undefined;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
};

const isOperatorObject = (cond) =>
  cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)
  && Object.keys(cond).some((k) => k.startsWith('$'));

function matchValue(value, cond) {
  if (!isOperatorObject(cond)) return same(value, cond);
  return Object.entries(cond).every(([op, arg]) => {
    switch (op) {
      case '$ne': return !same(value, arg);
      case '$lt': return value != null && value < arg;
      case '$lte': return value != null && value <= arg;
      case '$gt': return value != null && value > arg;
      case '$gte': return value != null && value >= arg;
      case '$in': return arg.includes(value);
      case '$exists': return (value !== undefined) === arg;
      case '$regex': return new RegExp(arg, cond.$options ?? '').test(String(value ?? ''));
      case '$options': return true;
      default: throw new Error(`fake model: unsupported operator ${op}`);
    }
  });
}

export function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === '$and') return cond.every((f) => matches(doc, f));
    if (key === '$or') return cond.some((f) => matches(doc, f));
    return matchValue(getPath(doc, key), cond);
  });
}

function applyUpdate(doc, update) {
  if (doc && typeof doc === 'object' && 'updatedAt' in doc) doc.updatedAt = new Date();
  const operators = Object.keys(update).filter((k) => k.startsWith('$'));
  if (operators.length === 0) return Object.assign(doc, update);
  for (const [op, fields] of Object.entries(update)) {
    for (const [key, value] of Object.entries(fields)) {
      if (op === '$set') doc[key] = value;
      else if (op === '$inc') doc[key] = (doc[key] ?? 0) + value;
      else if (op === '$unset') delete doc[key];
      else if (op === '$setOnInsert') { /* only applies when an upsert inserts (see upsertDocument) */ }
      else throw new Error(`fake model: unsupported update operator ${op}`);
    }
  }
  return doc;
}

const compare = (a, b) => {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : 1;
};

// Options: hidden (fields not returned unless selected with +name), onSave(doc), defaults (schema defaults),
// methods (instance methods), statics (static properties, e.g. schema), collection (name used by $lookup),
// populateRefs ({ path: 'ModelName' }: what .populate(path) resolves, used by the local harness), timestamps
// (set createdAt/updatedAt like { timestamps: true }), autoCreatedAt (default true: save() stamps createdAt; the
// audit log and session models have their own date fields and no createdAt).
export function fakeModule(name, { hidden = [], onSave, defaults = {}, methods = {}, statics = {}, collection, populateRefs = {}, timestamps = false, autoCreatedAt = true, unique = [] } = {}) {
  const store = { docs: [] };

  // A unique index: a second document with the same non-empty value fails like MongoDB does (error code 11000).
  function checkUnique(doc) {
    for (const field of unique) {
      const value = getPath(doc, field);
      if (value === undefined || value === null) continue;
      if (store.docs.some((d) => d !== doc && getPath(d, field) === value)) {
        const error = new Error(`E11000 duplicate key error collection: ${name} index: ${field}_1`);
        error.code = 11000;
        throw error;
      }
    }
  }

  class Model {
    constructor(data = {}) {
      Object.assign(this, defaults, data);
      Object.defineProperty(this, '$locals', { value: {}, enumerable: false, writable: true });
    }

    async save() {
      this._id ??= oid();
      if (autoCreatedAt) this.createdAt ??= new Date();
      if (timestamps) this.updatedAt = new Date();
      if (onSave) await onSave(this);
      if (!store.docs.includes(this)) {
        checkUnique(this);
        store.docs.push(this);
      }
      return this;
    }

    static create(data) { return new Model(data).save(); }

    static find(filter) { return new Query('find', filter); }
    static exists(filter) { return new Query('exists', filter); }
    static findOne(filter) { return new Query('findOne', filter); }
    static findById(id) { return new Query('findOne', { _id: id }, { byId: true }); }
    static countDocuments(filter = {}) {
      Model.calls.push({ op: 'countDocuments', filter });
      return Promise.resolve(store.docs.filter((d) => matches(d, filter)).length);
    }
    static findByIdAndUpdate(id, update, options = {}) { return new Query('update', { _id: id }, { update, options }); }
    static findOneAndUpdate(filter, update, options = {}) { return new Query('update', filter, { update, options }); }
    static updateOne(filter, update, options = {}) { return new Query('updateOne', filter, { update, options }); }
    static updateMany(filter, update) { return new Query('updateMany', filter, { update }); }
    static findByIdAndDelete(id) { return new Query('delete', { _id: id }); }
    static deleteOne(filter) { return new Query('deleteOne', filter); }
    static deleteMany(filter) { return new Query('deleteMany', filter); }
    static async insertMany(docs) {
      const saved = [];
      for (const d of docs) saved.push(await new Model(d).save());
      return saved;
    }
    static aggregate(pipeline) {
      Model.calls.push({ op: 'aggregate', pipeline });
      return Promise.resolve(Model.aggregateImpl(pipeline));
    }

    // ---- test helpers ----
    // raw: true stores the document exactly as given (no schema defaults), like one written before a field existed.
    static seed(docs, { raw = false } = {}) {
      return docs.map((d) => {
        const doc = new Model({ createdAt: new Date(), ...d, _id: d._id ?? oid() });
        if (raw) for (const key of Object.keys(defaults)) if (!(key in d)) delete doc[key];
        store.docs.push(doc);
        return doc;
      });
    }
    static get docs() { return store.docs; }
    static reset() { store.docs.length = 0; Model.calls.length = 0; Model.aggregateImpl = () => []; }
    static resetData() { store.docs.length = 0; Model.calls.length = 0; }
    static byId(id) { return store.docs.find((d) => String(d._id) === String(id)); }
  }
  Object.assign(Model.prototype, methods);
  Object.assign(Model, statics);
  if (collection) Model.collection = { name: collection };
  Model.calls = [];
  Model.aggregateImpl = () => [];
  Object.defineProperty(Model, 'name', { value: name });

  const plain = (doc) => JSON.parse(JSON.stringify(doc), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v));

  // What MongoDB does when an upsert finds nothing: a new document made of the filter's equality fields, the
  // update's $setOnInsert and $set fields on top, saved like any other (timestamps, unique indexes).
  async function upsertDocument(filter, update) {
    const base = {};
    for (const [key, cond] of Object.entries(filter)) {
      if (key.startsWith('$') || isOperatorObject(cond)) continue;
      const parts = key.split('.');
      let target = base;
      for (const part of parts.slice(0, -1)) target = (target[part] ??= {});
      target[parts.at(-1)] = cond;
    }
    const doc = new Model({ ...defaults, ...base });
    Object.assign(doc, update.$setOnInsert ?? {});
    applyUpdate(doc, Object.fromEntries(Object.entries(update).filter(([op]) => op !== '$setOnInsert')));
    return doc.save();
  }

  class Query {
    constructor(kind, filter = {}, extra = {}) {
      this.kind = kind;
      this.filter = filter;
      this.extra = extra;
      this.info = { op: kind, filter, ...(extra.update ? { update: extra.update, options: extra.options } : {}) };
      Model.calls.push(this.info);
    }
    sort(spec) { this.info.sort = spec; return this; }
    skip(n) { this.info.skip = n; return this; }
    limit(n) { this.info.limit = n; return this; }
    select(spec) { this.info.select = spec; return this; }
    populate(path, select) { this.info.populate = { path, select }; return this; }
    lean() { this.info.lean = true; return this; }
    then(resolve, reject) { return this.exec().then(resolve, reject); }

    present(doc) {
      if (!doc) return doc;
      const selected = String(this.info.select ?? '');
      const tokens = selected.split(/\s+/).filter(Boolean);
      const drop = new Set(hidden.filter((h) => !tokens.includes(`+${h}`)));
      for (const t of tokens) if (t.startsWith('-')) drop.add(t.slice(1));
      const keep = tokens.filter((t) => !t.startsWith('-') && !t.startsWith('+'));
      const out = this.info.lean ? plain(doc) : Object.assign(Object.create(Model.prototype), plain(doc));
      if (!this.info.lean) Object.defineProperty(out, '$locals', { value: {}, enumerable: false });
      for (const key of drop) delete out[key];
      if (keep.length) for (const key of Object.keys(out)) if (!keep.includes(key) && key !== '_id') delete out[key];
      return out;
    }

    // .populate(path, select): replaces an id by { _id, ...selected fields } of the referenced document, when the
    // model was given populateRefs (the local harness). Without it the call is only recorded, as before.
    populated(doc) {
      const pop = this.info.populate;
      const ref = pop && populateRefs[pop.path];
      if (!doc || !ref || !fakes[ref]) return doc;
      const target = fakes[ref].byId(doc[pop.path]);
      if (!target) return doc;
      const picked = { _id: target._id };
      for (const key of String(pop.select ?? '').split(/\s+/).filter(Boolean)) picked[key] = target[key];
      doc[pop.path] = pop.select ? picked : plain(target);
      return doc;
    }

    async exec() {
      const { kind, filter, extra } = this;
      const found = () => store.docs.filter((d) => matches(d, filter));
      if (kind === 'find') {
        let docs = found();
        const sort = this.info.sort;
        if (sort) {
          const keys = Object.entries(sort);
          docs = [...docs].sort((a, b) => { for (const [k, dir] of keys) { const c = compare(getPath(a, k), getPath(b, k)); if (c) return c * dir; } return 0; });
        }
        const skip = this.info.skip ?? 0;
        docs = docs.slice(skip, this.info.limit === undefined ? undefined : skip + this.info.limit);
        return docs.map((d) => this.populated(this.present(d)));
      }
      if (kind === 'findOne') return this.populated(this.present(found()[0] ?? null));
      if (kind === 'exists') {
        const doc = found()[0];
        return doc ? { _id: doc._id } : null;
      }
      if (kind === 'update') {
        const doc = found()[0];
        if (!doc && extra.options?.upsert) {
          const inserted = await upsertDocument(filter, extra.update);
          return extra.options.new ? this.present(inserted) : null;
        }
        if (!doc) return null;
        const before = plain(doc);
        applyUpdate(doc, extra.update);
        return this.present(extra.options.new ? doc : before);
      }
      if (kind === 'updateOne') {
        const doc = found()[0];
        if (doc) applyUpdate(doc, extra.update);
        else if (extra.options?.upsert) {
          await upsertDocument(filter, extra.update);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 };
      }
      if (kind === 'deleteOne') {
        const doc = found()[0];
        if (doc) store.docs.splice(store.docs.indexOf(doc), 1);
        return { deletedCount: doc ? 1 : 0 };
      }
      if (kind === 'deleteMany') {
        const docs = found();
        for (const d of docs) store.docs.splice(store.docs.indexOf(d), 1);
        return { deletedCount: docs.length };
      }
      if (kind === 'updateMany') {
        const docs = found();
        docs.forEach((d) => applyUpdate(d, extra.update));
        return { matchedCount: docs.length, modifiedCount: docs.length };
      }
      if (kind === 'delete') {
        const doc = found()[0];
        if (doc) store.docs.splice(store.docs.indexOf(doc), 1);
        return doc ?? null;
      }
      throw new Error(`fake model: unsupported query ${kind}`);
    }
  }

  fakes[name] = Model;
  return { default: Model };
}

// A bcrypt hash cheap enough for tests (cost 4) of a known password.
export const quickHash = (password) => bcrypt.hashSync(password, 4);

// The Admin model as the routes see it: schema defaults, comparePassword, the hidden TOTP secret, and the save hook
// (a plain password is hashed unless the caller marked it as already hashed).
export const fakeAdminModule = () => fakeModule('Admin', {
  hidden: ['totpSecretEnc', 'resetTokenHash'],
  defaults: { role: 'owner', disabled: false, failedLogins: 0, lockedUntil: null, totpEnabled: false, totpLastStep: -1, lastLoginAt: null, resetTokenHash: null, resetTokenExpires: null },
  methods: { comparePassword(password) { return bcrypt.compare(password, this.password); } },
  onSave: async (doc) => { if (!doc.$locals.passwordHashed && !String(doc.password).startsWith('$2')) doc.password = quickHash(doc.password); },
});
