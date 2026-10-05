// A tiny MongoDB aggregation interpreter for the local harness. It understands exactly what the dashboard and the
// catalogue use ($match $unwind $group $sort $limit $lookup $project with $sum $avg $last $cond $eq $ifNull
// $arrayElemAt $multiply $dateToString $ne), and throws on anything else so a new pipeline cannot silently return
// nothing. It is NOT a general implementation.
import { matches } from './fake-models.js';

// A dotted path; through an array it collects the values of every element (as MongoDB does: '$product.name' on
// the array a $lookup produced is the list of names).
const getPath = (doc, path) => path.split('.').reduce((value, key) => {
  if (value == null) return undefined;
  return Array.isArray(value) ? value.map((item) => item?.[key]) : value[key];
}, doc);

const dayParts = (date, timeZone) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(date); // YYYY-MM-DD
};

function evaluate(expr, doc) {
  if (typeof expr === 'string') return expr.startsWith('$') ? getPath(doc, expr.slice(1)) : expr;
  if (expr === null || typeof expr !== 'object' || expr instanceof Date) return expr;
  if (Array.isArray(expr)) return expr.map((e) => evaluate(e, doc));
  const [op, arg] = Object.entries(expr)[0];
  switch (op) {
    case '$cond': {
      const [test, yes, no] = arg;
      return evaluate(test, doc) ? evaluate(yes, doc) : evaluate(no, doc);
    }
    case '$eq': return evaluate(arg[0], doc) === evaluate(arg[1], doc);
    case '$ne': return evaluate(arg[0], doc) !== evaluate(arg[1], doc);
    case '$ifNull': { const v = evaluate(arg[0], doc); return v === null || v === undefined ? evaluate(arg[1], doc) : v; }
    case '$arrayElemAt': { const list = evaluate(arg[0], doc); return Array.isArray(list) ? list[arg[1]] : undefined; }
    case '$multiply': return arg.reduce((product, e) => product * (Number(evaluate(e, doc)) || 0), 1);
    case '$dateToString': {
      const date = evaluate(arg.date, doc);
      if (!(date instanceof Date)) return null;
      if (arg.format !== '%Y-%m-%d') throw new Error(`aggregate: unsupported date format ${arg.format}`);
      return dayParts(date, arg.timezone ?? 'UTC');
    }
    default: {
      // A plain object of expressions (as in a $group _id or a $project field).
      if (op.startsWith('$')) throw new Error(`aggregate: unsupported operator ${op}`);
      return Object.fromEntries(Object.entries(expr).map(([k, v]) => [k, evaluate(v, doc)]));
    }
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function group(docs, spec) {
  const buckets = new Map();
  for (const doc of docs) {
    const id = evaluate(spec._id, doc);
    const key = JSON.stringify(id ?? null);
    if (!buckets.has(key)) buckets.set(key, { id, docs: [] });
    buckets.get(key).docs.push(doc);
  }
  return [...buckets.values()].map(({ id, docs: members }) => {
    const row = { _id: id };
    for (const [field, acc] of Object.entries(spec)) {
      if (field === '_id') continue;
      const [op, arg] = Object.entries(acc)[0];
      const values = members.map((d) => evaluate(arg, d));
      if (op === '$sum') row[field] = values.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
      else if (op === '$avg') {
        const nums = values.filter((v) => typeof v === 'number');
        row[field] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      } else if (op === '$last') row[field] = values[values.length - 1];
      else throw new Error(`aggregate: unsupported accumulator ${op}`);
    }
    return row;
  });
}

const compareValues = (a, b) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a < b ? -1 : 1);

// `collections(name)` resolves a $lookup `from` (a collection name) to the documents of that collection.
export function runPipeline(sourceDocs, pipeline, collections) {
  let docs = sourceDocs.map((d) => JSON.parse(JSON.stringify(d), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v)));
  for (const stage of pipeline) {
    const [name, spec] = Object.entries(stage)[0];
    if (name === '$match') docs = docs.filter((d) => matches(d, spec));
    else if (name === '$unwind') {
      const field = (typeof spec === 'string' ? spec : spec.path).slice(1);
      docs = docs.flatMap((d) => {
        const list = getPath(d, field);
        return Array.isArray(list) ? list.map((item) => ({ ...d, [field]: item })) : [];
      });
    } else if (name === '$group') docs = group(docs, spec);
    else if (name === '$sort') {
      const keys = Object.entries(spec);
      docs = [...docs].sort((a, b) => { for (const [k, dir] of keys) { const c = compareValues(getPath(a, k), getPath(b, k)); if (c) return c * dir; } return 0; });
    } else if (name === '$limit') docs = docs.slice(0, spec);
    else if (name === '$lookup') {
      const foreign = collections(spec.from);
      docs = docs.map((d) => ({ ...d, [spec.as]: foreign.filter((f) => same(getPath(f, spec.foreignField), getPath(d, spec.localField)) || String(getPath(f, spec.foreignField)) === String(getPath(d, spec.localField))) }));
    } else if (name === '$project') {
      docs = docs.map((d) => {
        const out = {};
        if (spec._id === undefined || spec._id) out._id = d._id;
        for (const [field, how] of Object.entries(spec)) {
          if (field === '_id') continue;
          out[field] = how === 1 ? d[field] : evaluate(how, d);
        }
        return out;
      });
    } else throw new Error(`aggregate: unsupported stage ${name}`);
  }
  return docs;
}
