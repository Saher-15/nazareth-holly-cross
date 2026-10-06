// CSV for the export routes, the same rules as the real API (server/route/admin/export.js): UTF-8 with a byte-order
// mark, RFC 4180 quoting only where needed, and formula-injection protection: a text cell starting with = + - @ (or a
// tab / carriage return) would be run as a formula by Excel and Sheets, so it gets a leading apostrophe.

export function csvCell(value, decode = (text) => text) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text = decode(String(value));
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows, decode) {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row), decode)).join(','));
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}
