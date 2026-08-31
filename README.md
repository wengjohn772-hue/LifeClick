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
