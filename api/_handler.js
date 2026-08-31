import app from '../server/index.js';

export function handleApiRequest(req, res) {
  return app(req, res);
}