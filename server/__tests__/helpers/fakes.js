import bcrypt from 'bcryptjs';

// A small in-memory stand-in for Mongoose models, so the admin API can be driven through HTTP without a database.
// It understands what the admin routes use: find / findOne / findById (+ sort skip limit select populate lean),
// countDocuments, create / new + save, findByIdAndUpdate, findOneAndUpdate, updateOne, updateMany,
// findByIdAndDelete, aggregate (answers come from Model.aggregateImpl), and the filter operators
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
  const operators = Object.keys(update).filter((k) => k.startsWith('$'));
  if (operators.length === 0) return Object.assign(doc, update);
  for (const [op, fields] of Object.entries(update)) {
    for (const [key, value] of Object.entries(fields)) {
      if (op === '$set') doc[key] = value;
      else if (op === '$inc') doc[key] = (doc[key] ?? 0) + value;
      else if (op === '$unset') delete doc[key];
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

export function fakeModule(name, { hidden = [], onSave, defaults = {}, methods = {} } = {}) {
  const store = { docs: [] };

  class Model {
    constructor(data = {}) {
      Object.assign(this, defaults, data);
      Object.defineProperty(this, '$locals', { value: {}, enumerable: false, writable: true });
    }

    async save() {
      this._id ??= oid();
      this.createdAt ??= new Date();
      if (onSave) await onSave(this);
      if (!store.docs.includes(this)) store.docs.push(this);
      return this;
    }

    static create(data) { return new Model(data).save(); }

    static find(filter) { return new Query('find', filter); }
    static findOne(filter) { return new Query('findOne', filter); }
    static findById(id) { return new Query('findOne', { _id: id }, { byId: true }); }
    static countDocuments(filter = {}) {
      Model.calls.push({ op: 'countDocuments', filter });
      return Promise.resolve(store.docs.filter((d) => matches(d, filter)).length);
    }
    static findByIdAndUpdate(id, update, options = {}) { return new Query('update', { _id: id }, { update, options }); }
    static findOneAndUpdate(filter, update, options = {}) { return new Query('update', filter, { update, options }); }
    static updateOne(filter, update) { return new Query('updateOne', filter, { update }); }
    static updateMany(filter, update) { return new Query('updateMany', filter, { update }); }
    static findByIdAndDelete(id) { return new Query('delete', { _id: id }); }
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
    static byId(id) { return store.docs.find((d) => String(d._id) === String(id)); }
  }
  Object.assign(Model.prototype, methods);
  Model.calls = [];
  Model.aggregateImpl = () => [];
  Object.defineProperty(Model, 'name', { value: name });

  const plain = (doc) => JSON.parse(JSON.stringify(doc), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v));

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
        return docs.map((d) => this.present(d));
      }
      if (kind === 'findOne') return this.present(found()[0] ?? null);
      if (kind === 'update') {
        const doc = found()[0];
        if (!doc) return null;
        const before = plain(doc);
        applyUpdate(doc, extra.update);
        return this.present(extra.options.new ? doc : before);
      }
      if (kind === 'updateOne') {
        const doc = found()[0];
        if (doc) applyUpdate(doc, extra.update);
        return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 };
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
  hidden: ['totpSecretEnc'],
  defaults: { role: 'owner', disabled: false, failedLogins: 0, lockedUntil: null, totpEnabled: false, totpLastStep: -1, lastLoginAt: null },
  methods: { comparePassword(password) { return bcrypt.compare(password, this.password); } },
  onSave: async (doc) => { if (!doc.$locals.passwordHashed && !String(doc.password).startsWith('$2')) doc.password = quickHash(doc.password); },
});
