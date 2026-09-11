import { config } from '../config.js';
import { isConnectionError } from '../db/pool.js';

/** Wraps an async route so a rejected promise reaches the error handler. */
export const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function notFound(_req, res) {
  res.status(404).json({ error: 'API route not found.', code: 'not_found' });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, _req, res, _next) {
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'That record already exists.', code: 'duplicate' });
  }

  if (isConnectionError(error)) {
    return res.status(503).json({ error: 'The LifeClick database is unavailable.', code: 'database_unavailable' });
  }

  console.error('[api]', error);

  return res.status(500).json({
    error: config.isProduction ? 'Something went wrong.' : error?.message || 'Something went wrong.',
    code: 'server_error',
  });
}
