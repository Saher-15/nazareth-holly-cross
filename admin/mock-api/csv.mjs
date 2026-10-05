// CSV for the export routes. A cell that starts with = + - @ (or a tab / carriage return) would be run as a formula
// by Excel and Sheets, so it gets a leading apostrophe; every cell is quoted and inner quotes are doubled.

export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(columns, rows) {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}
