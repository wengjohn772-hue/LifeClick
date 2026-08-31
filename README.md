# LifeClick

LifeClick is a safety-focused app with a live geolocation map, trusted contacts, and a backend-ready architecture for production storage and escalation flows.

## Quick start

1. Install dependencies:
   `npm install`
2. Copy the environment template:
   `cp .env.example .env`
3. Add your Google Maps JavaScript API key to `.env`.
4. Start the frontend:
   `npm run dev`
5. Start the backend API:
   `npm run dev:server`

## Google Maps setup

Add the following key to `.env`:

`VITE_GOOGLE_MAPS_API_KEY=your_google_maps_javascript_key_here`

The map uses Google satellite mode and centers automatically when the browser accepts location access.

## Database setup

DBeaver is the database client. You still need a PostgreSQL database, either installed locally or hosted by a provider such as Neon, Supabase, or Railway.

### Option A: Local PostgreSQL

1. Install PostgreSQL for your operating system.
2. Start the PostgreSQL service.
3. Create the application database:

   ```sql
   CREATE DATABASE lifeclick;
   ```

4. Open DBeaver and create a PostgreSQL connection with:
   - Host: `localhost`
   - Port: `5432`
   - Database: `lifeclick`
   - Username: your PostgreSQL username
   - Password: your PostgreSQL password
5. Open `server/db/schema.sql` in DBeaver.
6. Select the `lifeclick` connection and execute the complete script.
7. Refresh the DBeaver database tree and confirm the `users`, `trusted_contacts`, `location_events`, `check_ins`, `alerts`, and `user_settings` tables exist.

### Connect the local project

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your actual PostgreSQL credentials:

   ```env
   DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/lifeclick
   PORT=4000
   ```

3. Start the API:

   ```bash
   npm run dev:server
   ```

4. In another terminal, check the connection:

   ```bash
   curl http://localhost:4000/api/health
   ```

   A working database returns:

   ```json
   {"ok":true,"database":"connected"}
   ```

5. Start the frontend with `npm run dev`. Account creation and live location records will now use PostgreSQL.

### Connect Vercel

For the deployed app, add these under **Vercel → Project Settings → Environment Variables**:

```env
DATABASE_URL=your-hosted-postgresql-connection-string
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Use a hosted PostgreSQL connection string for Vercel. Do not use `localhost` in Vercel. Run `server/db/schema.sql` against that hosted database through DBeaver, then redeploy the Vercel project.

## Backend architecture

The backend is deliberately simple and production-friendly:

- Express API under `server/index.js`
- PostgreSQL-ready connection using `pg`
- SQL bootstrap file at `server/db/schema.sql`
- DBeaver can connect to the PostgreSQL database using the `DATABASE_URL` value in `.env`

Example database URL:

`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifeclick`

Open DBeaver, create a PostgreSQL connection, and run the SQL from `server/db/schema.sql` for local testing.

## API endpoints

- `GET /api/health` - backend health
- `GET /api/location` - returns current or demo location payload
- `POST /api/location` - stores a location event in PostgreSQL when configured
- `GET /api/contacts` - returns trusted contact data

## Notes

- If no Google key is configured, the app falls back to a safe default map center while still keeping the geolocation flow active.
- If the browser denies location permission, the UI explains that the map cannot show the live position until access is accepted.
