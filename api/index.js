import app from '../server/index.js';

/**
 * Single Vercel function serving the whole API.
 *
 * vercel.json rewrites `/api/(.*)` here and passes the captured path as
 * `__apiPath`. That explicitness is deliberate: relying on Vercel's filesystem
 * catch-all (`api/[...path].js`) silently matched only single-segment routes
 * once a `rewrites` block was present, so `/api/health` worked while
 * `/api/auth/register` returned 404 before ever reaching Express.
 *
 * New endpoints only need adding to the Express app.
 */
export default function handler(req, res) {
  const { __apiPath, ...query } = req.query || {};

  if (typeof __apiPath === 'string') {
    // Rebuild the path Express routes on, preserving the caller's own query
    // parameters and dropping the marker we injected.
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) value.forEach((entry) => search.append(key, entry));
      else if (value !== undefined && value !== null) search.append(key, String(value));
    }
    const suffix = search.toString();
    req.url = `/api/${__apiPath}${suffix ? `?${suffix}` : ''}`;
  } else if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
