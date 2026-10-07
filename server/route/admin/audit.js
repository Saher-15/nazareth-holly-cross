import express from 'express';
import mongoose from 'mongoose';
import Admin from '../../model/admin.js';
import AuditLog from '../../model/auditLog.js';
import Product from '../../model/product.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { orderNumber } from '../../utils/orderNumber.js';
import { isObjectId } from '../../utils/validate.js';
import { paginate, parseList } from './common.js';

// GET /admin/audit?page&size&actor&action&q&sort   OWNER ONLY (mounted behind requireRole('owner') in index.js)
//   actor   the account name (exact)           action  e.g. 'auth.login_failed' (exact); 'auth.' = every auth.* action
//   q       text in actor, action or target id  sort    'at' or '-at' (default newest first)
// Entries are written by services/audit.js and kept for 180 days (TTL index).
// Each item also carries `targetName` when the target can be named for a person reading the log: a user's username, a
// product's name (both looked up now: a deleted one keeps the name its delete entry recorded), an order's number.

const router = express.Router();

const ACTION = /^[a-z0-9_.-]{1,60}$/;

router.get('/', asyncHandler(async (req, res) => {
  const params = parseList(req.query, {
    searchFields: ['actorName', 'action', 'target.id'],
    sorts: { at: true },
    defaultSort: '-at',
  });

  const extra = [];
  const { actor, action } = req.query;
  if (actor !== undefined) {
    if (typeof actor !== 'string' || actor.length === 0 || actor.length > 100) throw new HttpError(400, 'Invalid actor');
    extra.push({ actorName: actor });
  }
  if (action !== undefined) {
    if (typeof action !== 'string' || !ACTION.test(action)) throw new HttpError(400, 'Invalid action');
    extra.push(action.endsWith('.')
      ? { action: mongoose.trusted({ $regex: `^${action.replace(/\./g, '\\.')}`, $options: '' }) }
      : { action });
  }
  const conditions = [...(Object.keys(params.filter).length ? [params.filter] : []), ...extra];
  params.filter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };

  const page = await paginate(AuditLog, params, { select: '-__v' });
  res.json({ ...page, items: await withTargetNames(page.items) });
}));

/** Adds `targetName` (users, products: looked up; orders: their number). Two queries at most, whatever the page size. */
export async function withTargetNames(items) {
  const idsOf = (type) => [...new Set(items.filter((e) => e.target?.type === type && isObjectId(String(e.target?.id ?? ''))).map((e) => String(e.target.id)))];
  const [users, products] = await Promise.all([
    idsOf('user').length ? Admin.find({ _id: mongoose.trusted({ $in: idsOf('user') }) }).select('username').lean() : [],
    idsOf('product').length ? Product.find({ _id: mongoose.trusted({ $in: idsOf('product') }) }).select('name').lean() : [],
  ]);
  const names = new Map([...users.map((u) => [`user:${u._id}`, u.username]), ...products.map((p) => [`product:${p._id}`, p.name])]);
  return items.map((e) => {
    const type = e.target?.type;
    const id = String(e.target?.id ?? '');
    const recorded = typeof e.meta?.username === 'string' ? e.meta.username : typeof e.meta?.name === 'string' ? e.meta.name : null;
    const targetName = type === 'order' && id ? orderNumber(id) : (names.get(`${type}:${id}`) ?? ((type === 'user' || type === 'product') ? recorded : null));
    return targetName ? { ...e, targetName } : e;
  });
}

export default router;
