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

  // A foreign key violation on user_id means the token is valid but its account
  // no longer exists — deleted on another device, or restored from a backup
  // taken before the account was created. Answering 401 lets the client clear
  // the dead session instead of showing a raw database error forever.
  if (error?.code === '23503') {
    const constraint = String(error.constraint || '');
    if (constraint.includes('user_id') || constraint.includes('author_user')) {
      return res.status(401).json({
        error: 'Your account no longer exists. Please sign in again.',
        code: 'account_missing',
      });
    }
    return res.status(409).json({ error: 'That record references something that no longer exists.', code: 'stale_reference' });
  }

  if (isConnectionError(error)) {
    return res.status(503).json({ error: 'The LifeClick database is unavailable.', code: 'database_unavailable' });
  }

  // body-parser rejects oversized bodies before any route runs; without this it
  // would surface as an opaque 500.
  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json({ error: 'That upload is too large.', code: 'payload_too_large' });
  }

  if (error?.type === 'entity.parse.failed' || error?.status === 400) {
    return res.status(400).json({ error: 'The request body could not be parsed.', code: 'invalid_json' });
  }

  console.error('[api]', error);

  return res.status(500).json({
    error: config.isProduction ? 'Something went wrong.' : error?.message || 'Something went wrong.',
    code: 'server_error',
  });
}
