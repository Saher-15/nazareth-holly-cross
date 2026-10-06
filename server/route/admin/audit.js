import express from 'express';
import mongoose from 'mongoose';
import AuditLog from '../../model/auditLog.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { paginate, parseList } from './common.js';

// GET /admin/audit?page&size&actor&action&q&sort   OWNER ONLY (mounted behind requireRole('owner') in index.js)
//   actor   the account name (exact)           action  e.g. 'auth.login_failed' (exact); 'auth.' = every auth.* action
//   q       text in actor, action or target id  sort    'at' or '-at' (default newest first)
// Entries are written by services/audit.js and kept for 180 days (TTL index).

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

  res.json(await paginate(AuditLog, params, { select: '-__v' }));
}));

export default router;
