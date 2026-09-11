import app from '../server/index.js';

// Single Vercel function serving the whole API.
//
// This uses Vercel's native catch-all filesystem routing rather than a
// vercel.json rewrite: with a rewrite, what `req.url` holds inside the function
// is ambiguous, whereas a dynamic route always populates `req.query.path` with
// the matched segments. New endpoints only need adding to the Express app.
export default function handler(req, res) {
  const segments = req.query?.path;

  if (segments) {
    // Rebuild the path Express should route on, preserving the query string.
    const pathname = `/api/${(Array.isArray(segments) ? segments : [segments]).join('/')}`;
    const queryIndex = req.url.indexOf('?');
    req.url = queryIndex === -1 ? pathname : `${pathname}${req.url.slice(queryIndex)}`;
  } else if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
