import mongoose from 'mongoose';
import { HttpError } from '../../utils/httpError.js';
import { isObjectId } from '../../utils/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';

// Pieces shared by the admin routes: bounded pagination, whitelisted sorting and filtering, safe text search.

export const MAX_PAGE = 10_000;
export const MAX_SIZE = 100;
export const DEFAULT_SIZE = 25;
export const MAX_Q = 100;

// A query-string value as text, or undefined. ?q[]=a and ?q[x]=y arrive as arrays and objects and are ignored.
const queryText = (value) => (typeof value === 'string' ? value.trim() : undefined);

const clampInt = (value, fallback, min, max) => {
  const n = Number.parseInt(queryText(value) ?? '', 10);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// ?page and ?size are always whole numbers within bounds (a bad value falls back to the default, an out-of-range
// one is clamped), so no request can ask the database for a negative skip or a million rows.
export const pageParams = (query) => {
  const page = clampInt(query.page, 1, 1, MAX_PAGE);
  const size = clampInt(query.size, DEFAULT_SIZE, 1, MAX_SIZE);
  return { page, size, skip: (page - 1) * size };
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// $or over `fields` for a case-insensitive "contains" search. The text is escaped, so it can only ever match
// literally (no regular-expression syntax reaches the database); mongoose.trusted keeps the $regex operator
// that sanitizeFilter would otherwise neutralise. A 24-hex text also matches the document id.
export function searchFilter(q, fields) {
  if (!q) return null;
  const pattern = escapeRegex(q);
  const clauses = fields.map((field) => ({ [field]: mongoose.trusted({ $regex: pattern, $options: 'i' }) }));
  if (isObjectId(q)) clauses.push({ _id: q });
  return { $or: clauses };
}

// Reads ?q, ?status, ?sort of a list request against what the resource allows.
//   statuses: { name: filterObject }   sorts: { 'createdAt': true, 'totalPrice': true }   (leading "-" = descending)
export function parseList(query, { searchFields = [], statuses = {}, sorts = { createdAt: true }, defaultSort = '-createdAt' }) {
  const { page, size, skip } = pageParams(query);
  const conditions = [];

  const q = queryText(query.q);
  if (q && q.length > MAX_Q) throw new HttpError(400, `Invalid q: at most ${MAX_Q} characters`);
  const search = searchFilter(q, searchFields);
  if (search) conditions.push(search);

  const status = queryText(query.status);
  if (status && status !== 'all') {
    if (!Object.hasOwn(statuses, status)) throw new HttpError(400, `Invalid status: use ${['all', ...Object.keys(statuses)].join(', ')}`);
    conditions.push(statuses[status]);
  }

  const sortText = queryText(query.sort) || defaultSort;
  const descending = sortText.startsWith('-');
  const field = descending ? sortText.slice(1) : sortText;
  if (!Object.hasOwn(sorts, field)) throw new HttpError(400, `Invalid sort: use ${Object.keys(sorts).join(', ')} (prefix - for descending)`);
  const sort = { [field]: descending ? -1 : 1, _id: -1 };

  const filter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };
  return { page, size, skip, filter, sort };
}

// The page of a collection: { items, total, page, size }.
export async function paginate(Model, params, { select, populate } = {}) {
  const { page, size, skip, filter, sort } = params;
  let query = Model.find(filter).sort(sort).skip(skip).limit(size);
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate.path, populate.select);
  const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);
  return { items, total, page, size };
}

// GET handler for a collection.
export const listHandler = (Model, listOptions, queryOptions) =>
  asyncHandler(async (req, res) => {
    res.json(await paginate(Model, parseList(req.query, listOptions), queryOptions));
  });

// A route parameter that must be a 24-hex document id (returned in lower case, so comparisons with stored ids hold).
export const objectId = (value) => {
  if (!isObjectId(value)) throw new HttpError(400, 'Invalid id');
  return value.toLowerCase();
};

export const found = (doc, what = 'Item') => {
  if (!doc) throw new HttpError(404, `${what} not found`);
  return doc;
};
