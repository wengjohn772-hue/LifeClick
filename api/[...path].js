import app from '../server/index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api')) req.url = `/api${req.url}`;
  return app(req, res);
}