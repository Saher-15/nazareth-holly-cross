import { HttpError } from './httpError.js';

// A small, strict, zod-like checker for request bodies. A shape maps each allowed field to a rule; a rule is a
// function (value, field) => cleaned value that throws HttpError(400) for anything it does not accept.
//
//   const body = parseBody(req.body, { name: str({ min: 2, max: 80 }), stock: opt(nullable(int({ min: 0 }))) });
//
// - The body must be a plain JSON object. Arrays, text and null are refused.
// - A field that is not in the shape is refused (no mass assignment, no silent typos).
// - A field is required unless its rule is wrapped in opt(); opt() fields that are absent are left out of the result.
// - Rules check the TYPE first: an object or array where text is expected never gets further.
// - Messages name the field and the rule, never the value that was sent.

const fail = (field, why) => {
  throw new HttpError(400, `Invalid ${field}${why ? `: ${why}` : ''}`);
};

const OPTIONAL = Symbol('optional');

// Marks a rule as optional (the field may be absent).
export const opt = (rule) => Object.assign((value, field) => rule(value, field), { [OPTIONAL]: true });

// The value, or null (a nullable field accepts an explicit null, e.g. "stock is not tracked").
export const nullable = (rule) => (value, field) => (value === null ? null : rule(value, field));

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/; // keeps tab, newline, carriage return

// Text. Trimmed by default; single-line unless multiline is set. Control characters are always refused.
export const str = ({ min = 1, max = 200, pattern, trim = true, multiline = false } = {}) => (value, field) => {
  if (typeof value !== 'string') fail(field, 'must be text');
  const text = trim ? value.trim() : value;
  if (text.length < min || text.length > max) fail(field, `length must be ${min} to ${max}`);
  if (CONTROL.test(text)) fail(field, 'contains control characters');
  if (!multiline && /[\r\n\t]/.test(text)) fail(field, 'must be a single line');
  if (pattern && !pattern.test(text)) fail(field, 'wrong format');
  return text;
};

// A secret typed by a person: never trimmed or altered, only bounded.
export const secret = ({ min = 1, max = 200 } = {}) => (value, field) => {
  if (typeof value !== 'string') fail(field, 'must be text');
  if (value.length < min || value.length > max) fail(field, `length must be ${min} to ${max}`);
  return value;
};

export const num = ({ min = -Infinity, max = Infinity } = {}) => (value, field) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(field, 'must be a number');
  if (value < min || value > max) fail(field, `must be between ${min} and ${max}`);
  return value;
};

export const int = ({ min = -Infinity, max = Infinity } = {}) => (value, field) => {
  if (!Number.isInteger(value)) fail(field, 'must be a whole number');
  if (value < min || value > max) fail(field, `must be between ${min} and ${max}`);
  return value;
};

export const bool = () => (value, field) => {
  if (typeof value !== 'boolean') fail(field, 'must be true or false');
  return value;
};

export const oneOf = (allowed) => (value, field) => {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(field, `must be one of ${allowed.join(', ')}`);
  return value;
};

export const arrayOf = (rule, { max = 50 } = {}) => (value, field) => {
  if (!Array.isArray(value)) fail(field, 'must be a list');
  if (value.length > max) fail(field, `at most ${max} items`);
  return value.map((item) => rule(item, field));
};

// Decodes the HTML entities express-xss-sanitizer writes into every body string, so a stored web address stays a
// working address (an "&" in a query string would otherwise be saved as "&amp;").
export const decodeEntities = (text) =>
  text.replace(/&(amp|lt|gt|quot|#39);/g, (_m, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[name]);

// An http(s) web address with no whitespace, quotes or angle brackets.
export const url = ({ max = 2048 } = {}) => (value, field) => {
  if (typeof value !== 'string') fail(field, 'must be text');
  const text = decodeEntities(value.trim());
  if (text.length < 8 || text.length > max) fail(field, `length must be 8 to ${max}`);
  if (!/^https?:\/\/[^\s<>"'`\\]+$/i.test(text)) fail(field, 'must be an http(s) address');
  try {
    if (!new URL(text).hostname) fail(field, 'must be an http(s) address');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    fail(field, 'must be an http(s) address');
  }
  return text;
};

export function parseBody(body, shape) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) fail('body', 'must be a JSON object');
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(shape, key)) throw new HttpError(400, `Unexpected field: ${key.replace(/[^\w.-]/g, '?').slice(0, 40)}`);
  }
  const clean = {};
  for (const [field, rule] of Object.entries(shape)) {
    const value = body[field];
    if (value === undefined) {
      if (!rule[OPTIONAL]) throw new HttpError(400, `${field} is required`);
      continue;
    }
    clean[field] = rule(value, field);
  }
  return clean;
}
