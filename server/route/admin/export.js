import express from 'express';
import Order from '../../model/order.js';
import Candle from '../../model/candle.js';
import Contact from '../../model/contact.js';
import Payment from '../../model/payment.js';
import { unfulfilledFilter } from '../../services/payments.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireRole } from '../../middleware/adminGuard.js';
import { audit } from '../../services/audit.js';
import { HttpError } from '../../utils/httpError.js';
import { decodeEntities } from '../../utils/schema.js';
import { orderNumber } from '../../utils/orderNumber.js';

const router = express.Router();

export const MAX_EXPORT_ROWS = 10_000;

// One CSV cell. Text that starts with = + - @ (or a tab or carriage return) would be run as a formula by Excel
// and Google Sheets ("=HYPERLINK(...)", "+cmd|..."): it is prefixed with an apostrophe so it stays text.
// Numbers and booleans are written as they are (they cannot start a formula). Cells containing a comma, a quote
// or a line break are quoted, with quotes doubled (RFC 4180).
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text = value instanceof Date ? value.toISOString() : decodeEntities(String(value)); // the API stores "&" as "&amp;"
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = (columns, rows) =>
  `﻿${[columns.map((c) => csvCell(c.header)).join(','), ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','))].join('\r\n')}\r\n`;
// (the leading byte-order mark makes Excel read the file as UTF-8, so Hebrew and Arabic names survive)

const field = (name) => ({ header: name, value: (row) => row[name] });
const id = { header: 'id', value: (row) => String(row._id) };

const RESOURCES = {
  orders: {
    Model: Order,
    columns: [
      // `number`: the order number the dashboard, the e-mails and the search use (utils/orderNumber.js)
      id, { header: 'number', value: (o) => orderNumber(o._id) }, field('createdAt'), field('firstName'), field('lastName'), field('email'), field('phone'), field('street'),
      field('city'), field('state'), field('postal'), field('country'), field('totalPrice'), field('done'),
      field('paymentVerified'), field('paypalOrderId'),
      { header: 'products', value: (o) => (o.products ?? []).map((p) => `${p.productName ?? ''} x${p.quantity ?? ''}${p.color ? ` (${p.color})` : ''}`).join('; ') },
    ],
  },
  candles: {
    Model: Candle,
    columns: [id, field('createdAt'), field('firstName'), field('lastName'), field('email'), field('prayer'), field('done')],
  },
  contacts: {
    Model: Contact,
    columns: [id, field('createdAt'), field('fullName'), field('email'), field('phone'), field('msg'), field('done')],
  },
  payments: {
    Model: Payment,
    columns: [
      id, field('createdAt'), field('capturedAt'), field('paypalOrderId'), field('type'), field('status'), field('amount'),
      field('currency'), field('payerEmail'), field('payerName'), field('donorName'),
      { header: 'linkedKind', value: (p) => p.linkedTo?.kind },
      { header: 'linkedId', value: (p) => (p.linkedTo?.id ? String(p.linkedTo.id) : '') },
      field('resolvedAt'), field('resolvedBy'), field('notes'),
    ],
  },
};

// GET /admin/export/orders.csv | candles.csv | contacts.csv | payments.csv   (editor or owner: it is a bulk copy of personal data)
router.get('/:file', requireRole('editor'), asyncHandler(async (req, res) => {
  const match = /^(orders|candles|contacts|payments)\.csv$/.exec(req.params.file);
  if (!match) throw new HttpError(404, 'Not found');
  const resource = match[1];
  const { Model, columns } = RESOURCES[resource];

  // payments.csv?status=unfulfilled: only the customers who paid but have no order / candle request saved.
  let filter = {};
  if (resource === 'payments' && req.query.status !== undefined) {
    if (req.query.status !== 'unfulfilled') throw new HttpError(400, 'Invalid status: use unfulfilled');
    filter = unfulfilledFilter();
  }
  const rows = await Model.find(filter).sort({ createdAt: -1 }).limit(MAX_EXPORT_ROWS).lean();
  await audit(req, `export.${resource}`, { type: resource, id: '' }, { rows: rows.length });
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${resource}-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(toCsv(columns, rows));
}));

export default router;
