import { config } from '../config/env.js';

// Maps known error types to a status and a message that is safe to show.
function describe(err) {
  if (err.name === 'HttpError') return { status: err.status, message: err.message, expected: true };
  if (err.name === 'ValidationError') return { status: 400, message: err.message, expected: true };
  if (err.name === 'CastError') return { status: 400, message: 'Invalid id', expected: true };
  if (err.type === 'entity.parse.failed') return { status: 400, message: 'Malformed JSON body', expected: true };
  if (err.type === 'entity.too.large') return { status: 413, message: 'Request body too large', expected: true };
  return { status: err.status || 500, message: null, expected: false };
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'Not found' });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const { status, message, expected } = describe(err);

  // Unexpected errors are always logged; expected ones (bad input) are not noise.
  if (!expected || status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${status}: ${err.message}`,
      config.isProd ? '' : err.stack);
  }

  if (res.headersSent) return next(err);

  const clientMessage = status >= 500
    ? (config.isProd ? 'Internal server error' : err.message)
    : message || err.message;
  res.status(status).json({ error: clientMessage });
};
