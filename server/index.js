import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { pool, hasDatabase } from './db/pool.js';
import { ensureSchema } from './db/migrate.js';
import { authRouter } from './routes/auth.js';
import { locationRouter } from './routes/location.js';
import { contactsRouter } from './routes/contacts.js';
import { profileRouter } from './routes/profile.js';
import { checkInsRouter } from './routes/checkins.js';
import { settingsRouter } from './routes/settings.js';
import { feedsRouter } from './routes/feeds.js';
import { pushRouter } from './routes/push.js';
import { securityRouter } from './routes/security.js';
import { jobsRouter } from './routes/jobs.js';
import { notFound, errorHandler, asyncRoute } from './middleware/errors.js';
import { accessLogger } from './lib/audit.js';

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin(origin, callback) {
      // Native apps and server-to-server calls send no Origin header; only
      // browser requests are constrained by the allowlist.
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);

// Bodies stay small everywhere except the feeds router, which accepts
// base64-encoded images and installs its own larger parser. Skipping it here
// matters: whichever parser runs first consumes the stream, so a global 100kb
// limit would reject an image upload before the feeds router ever saw it.
const parseJson = express.json({ limit: '100kb' });
app.use((req, res, next) => {
  if (req.path.startsWith('/api/feeds')) return next();
  return parseJson(req, res, next);
});

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Slow down.', code: 'rate_limited' },
  })
);

// Migrations run once per process, before the first request touches a table.
app.use(
  asyncRoute(async (_req, _res, next) => {
    await ensureSchema();
    next();
  })
);

app.get(
  '/api/health',
  asyncRoute(async (_req, res) => {
    if (!hasDatabase()) {
      return res.json({
        ok: true,
        database: 'not-configured',
        demoAuth: config.allowDemoAuth,
      });
    }

    const schema = await ensureSchema();
    try {
      await pool.query('SELECT 1');
      return res.json({
        ok: schema.ok,
        database: 'connected',
        // Surfaced rather than swallowed, so a failed migration is visible.
        migrations: schema.ok ? 'applied' : `failed: ${schema.reason}`,
        demoAuth: config.allowDemoAuth,
      });
    } catch (error) {
      return res.status(503).json({ ok: false, database: 'disconnected', error: error.message });
    }
  })
);

// Records every authenticated request. Registered before the routers so the
// finish handler is attached, but it only writes once requireAuth has
// identified the user.
app.use(accessLogger);

app.use('/api/auth', authRouter);
app.use('/api/location', locationRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/checkins', checkInsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/feeds', feedsRouter);
app.use('/api/push-tokens', pushRouter);
app.use('/api/security', securityRouter);
app.use('/api/jobs', jobsRouter);

app.use('/api', notFound);
app.use(errorHandler);

export default app;

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`LifeClick backend running on http://localhost:${config.port}`);
    if (!hasDatabase()) {
      console.log(
        config.allowDemoAuth
          ? '[server] No DATABASE_URL. Demo auth is ENABLED — any credentials will be accepted.'
          : '[server] No DATABASE_URL. Auth routes will return 503 until one is set.'
      );
    }
  });
}
