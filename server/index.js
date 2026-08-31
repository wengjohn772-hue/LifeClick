import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 4000);
const databaseUrl = process.env.DATABASE_URL;

app.use(cors());
app.use(express.json());

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

app.get('/api/health', async (_req, res) => {
  if (!pool) {
    return res.json({ ok: true, database: 'not-configured' });
  }

  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, database: 'disconnected', error: error.message });
  }
});

app.get('/api/location', (_req, res) => {
  res.json({
    userId: 'demo-user',
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 25,
    status: 'demo',
    capturedAt: new Date().toISOString(),
  });
});

app.post('/api/location', async (req, res) => {
  const { userId, latitude, longitude, accuracy, status } = req.body || {};

  if (!userId || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return res.status(400).json({ error: 'userId, latitude, and longitude are required.' });
  }

  if (Number(latitude) < -90 || Number(latitude) > 90 || Number(longitude) < -180 || Number(longitude) > 180) {
    return res.status(400).json({ error: 'Coordinates are outside valid ranges.' });
  }

  if (!pool) {
    return res.status(202).json({
      ok: true,
      saved: false,
      message: 'Database not configured. Location accepted in local demo mode.',
      payload: { userId, latitude, longitude, accuracy, status },
    });
  }

  try {
    await pool.query(
      `INSERT INTO location_events (user_id, latitude, longitude, accuracy, status, captured_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, Number(latitude), Number(longitude), Number(accuracy) || 0, status || 'live']
    );

    res.json({ ok: true, saved: true, message: 'Location stored' });
  } catch (error) {
    res.status(500).json({ ok: false, saved: false, error: error.message });
  }
});

app.get('/api/contacts', (_req, res) => {
  res.json([
    { id: 'contact-1', name: 'Maya', phone: '+1-555-0101', relationship: 'Sister' },
    { id: 'contact-2', name: 'Leo', phone: '+1-555-0102', relationship: 'Friend' },
    { id: 'contact-3', name: 'Asha', phone: '+1-555-0103', relationship: 'Roommate' },
  ]);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, method } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const safeEmail = String(email).trim();
  let user = {
    id: 'user-demo-1',
    name: method === 'google' ? 'Ava Brooks' : 'LifeClick User',
    email: safeEmail,
    provider: method || 'email',
  };

  if (pool) {
    try {
      const result = await pool.query(
        `INSERT INTO users (email, name, phone, password_hash, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, email, name`,
        [safeEmail, user.name, '+1-555-0100', password]
      );
      if (result.rows[0]) {
        user = { ...user, id: result.rows[0].id, email: result.rows[0].email, name: result.rows[0].name };
      }
    } catch (error) {
      console.warn('User insert skipped:', error.message);
    }
  }

  res.json({ ok: true, user });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone, address, trustedContacts = [] } = req.body || {};

  if (!name || !email || !password || !phone || !address) {
    return res.status(400).json({ error: 'Full name, email, password, number, and address are required.' });
  }

  const safeEmail = String(email).trim().toLowerCase();
  const safeContacts = Array.isArray(trustedContacts)
    ? trustedContacts.filter((contact) => contact?.name && contact?.phone).slice(0, 5)
    : [];

  if (!pool) {
    return res.status(202).json({
      ok: true,
      saved: false,
      user: { id: `user-${Date.now()}`, name: String(name).trim(), email: safeEmail, provider: 'email', fafId: 'FAF-DEMO' },
      trustedContacts: safeContacts,
      message: 'Database not configured. Account accepted in local demo mode.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO users (email, name, phone, address, faf_id, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, name, phone, address, faf_id`,
      [safeEmail, String(name).trim(), String(phone).trim(), String(address).trim(), `FAF-${Math.floor(1000 + Math.random() * 9000)}`, password]
    );
    const user = result.rows[0];
    for (const contact of safeContacts) {
      await client.query(
        `INSERT INTO trusted_contacts (user_id, name, phone, relationship, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [user.id, String(contact.name).trim(), String(contact.phone).trim(), String(contact.relation || 'Trusted contact').trim()]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({
      ok: true,
      saved: true,
      user: { id: user.id, name: user.name, email: user.email, provider: 'email', phone: user.phone, address: user.address, fafId: user.faf_id },
      trustedContacts: safeContacts,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'An account with that email already exists.' : error.message });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`LifeClick backend running on http://localhost:${PORT}`);
});
