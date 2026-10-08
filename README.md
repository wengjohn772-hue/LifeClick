# Inertia

Inertia is a proactive personal-safety app: a check-in timer, trusted contacts, live location, and a risk dashboard.

The repository holds three pieces:

| Path | What it is |
| --- | --- |
| `apps/mobile/` | Expo SDK 57 iOS/Android app — the primary delivery target |
| `src/` | Vite React web app — the investor/demo prototype, still live |
| `server/` + `api/` | Express API, PostgreSQL schema, and the Vercel serverless entry point |

## Quick start

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and JWT_SECRET
npm run dev:server            # API on :4000
npm run dev                   # web prototype on :5173
```

Mobile:

```bash
cd apps/mobile
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_BASE_URL
npx expo start
```

> A physical device cannot reach `localhost` — that resolves to the phone itself.
> Set `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN address (e.g.
> `http://192.168.1.20:4000`) or a deployed API URL.

## Environment variables

See `.env.example` (server and web) and `apps/mobile/.env.example` (mobile). Two matter most:

- **`JWT_SECRET`** — required. The API **refuses to start in production without it**. Generate with `openssl rand -base64 48`. Changing it invalidates every session.
- **`ALLOW_DEMO_AUTH`** — leave unset. When `true`, the API issues a session for *any* credentials while the database is unreachable, so investor demos keep working. Without it, a database-less deploy fails closed with a 503 rather than authenticating anyone.

`ALLOWED_ORIGINS` restricts which browser origins may call the API. Native apps send no `Origin` header and are unaffected, but the deployed web app's URL must be listed.

## Database

Any PostgreSQL works — local, Neon, Supabase, Railway.

```sql
CREATE DATABASE inertia;
```

Then set `DATABASE_URL` and start the API. **Migrations run automatically on first request.** They live in `server/db/migrations/` as JS modules (not a runtime file read, which Vercel's bundler cannot trace) and are tracked in a `schema_migrations` table, so they apply exactly once and are safe to re-run.

`server/db/schema.sql` is kept as a human-readable reference of the baseline shape; it is no longer what creates the schema.

Confirm everything is wired up:

```bash
curl http://localhost:4000/api/health
# {"ok":true,"database":"connected","migrations":"applied","demoAuth":false}
```

A failed migration is reported in that payload rather than silently swallowed.

### Vercel

Set under **Project Settings → Environment Variables**:

```env
DATABASE_URL=your-hosted-postgresql-connection-string
JWT_SECRET=your-generated-secret
ALLOWED_ORIGINS=https://your-app.vercel.app
VITE_GOOGLE_MAPS_API_KEY=...
VITE_GOOGLE_CLIENT_ID=...
```

Never use `localhost` in Vercel. `vercel.json` rewrites `/api/*` to a single function (`api/index.js`), so new routes only need adding to the Express app.

## Authentication

- Passwords are hashed with bcrypt. Accounts created before hashing existed are **upgraded transparently**: the first successful sign-in verifies the stored plaintext, then immediately rewrites it as a hash. Users notice nothing.
- Sign-in returns a short-lived **access token** (JWT, 1h) and a long-lived **refresh token** (30d). Refresh tokens are stored hashed in `auth_sessions` and **rotate on every use**, so a stolen token is usable at most once. Both clients refresh transparently on a 401.
- Every private route requires `Authorization: Bearer <token>`, and **derives the user from the token** — a `userId` in a request body is ignored.

## Background safety monitoring

The check-in deadline lives on the **server** (`user_safety_state`), not the device. That is what makes monitoring work when the app is closed, suspended, or killed — the OS can stop your process, but it cannot stop the sweep.

```
check-in  ──►  server stores next_check_in_at
                        │
              scheduler calls /api/jobs/safety-sweep
                        │
              deadline passed?  ──► open incident, push "are you safe?"
                        │
              still silent after ESCALATION_GRACE_MINUTES?
                        │
                        └──► alert trusted contacts + last known location
```

Checking in — from the app or straight from the push notification — resolves the incident before contacts are ever alerted. Signing out pauses monitoring, so a deliberately closed app never escalates.

### Running the scheduler

Nothing escalates unless something calls the sweep on a schedule. **Detection latency equals the gap between runs**, so a 120-second collision countdown needs roughly a one-minute cadence.

#### What is wired up

**`.github/workflows/safety-sweep.yml`** is the driver. GitHub's scheduler will not fire more often than every 5 minutes, which is far too coarse, so each run pings once a minute for the five minutes it owns — one 5-minute trigger, five sweeps, ~1-minute latency. Actions minutes are free and unlimited on a public repo.

It needs two repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
| --- | --- |
| `SWEEP_URL` | `https://life-click-rho.vercel.app/api/jobs/safety-sweep` |
| `CRON_SECRET` | the same value as the `CRON_SECRET` environment variable in Vercel |

Then run it once by hand from the **Actions** tab (*Safety sweep → Run workflow*) to confirm the secrets are right. If all five pings fail the run goes **red and GitHub emails you** — for a safety monitor, a driver that has quietly stopped is the thing most worth being told about.

**`vercel.json`** schedules `/api/jobs/prune` daily for data retention. That one is fine at daily frequency, which is all Vercel's Hobby plan allows.

#### Caveats worth knowing

- GitHub's cron is best-effort and can be delayed under load, so the real-world gap is sometimes 2–3 minutes rather than 1.
- **Scheduled workflows are disabled automatically after 60 days without a commit to the repo.** If the project goes quiet, monitoring stops. Check `/api/health` or push a commit.
- For a production safety service, move to a paid per-minute cron (cron-job.org, Upstash QStash) or Vercel Pro and replace the workflow with a `"* * * * *"` entry in `vercel.json`. Both hit the same endpoint, so it is a one-line swap.

#### Checking it is alive

`GET /api/health` reports the scheduler heartbeat:

```json
"scheduler": {
  "configured": true, "everRan": true, "healthy": true,
  "secondsSinceLastRun": 43, "runCount": 120, "skippedCount": 0,
  "lastOk": true, "lastDetail": { "incidentsOpened": 0, "impactsEscalated": 0, "failures": 0 }
}
```

`healthy` goes false once no sweep has finished for `SWEEP_STALE_AFTER_SECONDS` (default 300). Watch that field — a monitor nobody is driving looks identical to a healthy one from the outside, which is exactly how abandoned impact countdowns went unnoticed before.

#### Notes

- `CRON_SECRET` **must** be set or the endpoint returns 503 and monitoring stays off. That fails safe: better visibly disabled than publicly triggerable. Both `x-cron-secret:` and `Authorization: Bearer` are accepted (the latter is what Vercel Cron sends), and `GET` works for services that cannot issue `POST`.
- The sweep holds a database lease, so it is safe to point several drivers at it or trigger it by hand while one is running — an overlapping run is skipped rather than alerting anyone's contacts twice. An escalation that dies part-way through is handed back and retried after `ESCALATION_RETRY_AFTER_MINUTES`.
- Locally, `npm run sweep` polls the endpoint on a loop as a stand-in.

```bash
curl -X POST https://life-click-rho.vercel.app/api/jobs/safety-sweep \
  -H "x-cron-secret: $CRON_SECRET"
```

### Escalation channels

Trusted contacts who are themselves Inertia users are reached by Expo push (free, no credentials). Contacts who aren't are recorded as `pending_sms` in `incident_notifications` — visible and auditable rather than silently dropped, and ready for an SMS provider to pick up. Adding Twilio means implementing one sender against that table; nothing else changes.

## Privacy, consent, and the security log

Inertia processes location, background position, and IP addresses. Each purpose is consented to **separately** on first run (`ConsentScreen`), and the agreed terms version is stored in `user_consents`.

| Data | Table | Retention |
| --- | --- | --- |
| Every authenticated request (IP, path, status) | `api_access_log` | `ACCESS_LOG_RETENTION_DAYS` (30) |
| Sign-ins, failed attempts, deletions | `security_events` | `SECURITY_LOG_RETENTION_DAYS` (180) |
| Location points | `location_events` | `LOCATION_RETENTION_DAYS` (90) |

Users see their own sign-in history and the networks their account was used from under **Settings → Security activity**. Failed sign-in attempts are surfaced prominently — that is what turns the log into a security feature rather than just collection.

**Withdrawing consent is real**: it stops monitoring and permanently deletes location history immediately, it does not merely flip a preference.

> `api_access_log` is by far the fastest-growing table — a device reporting background location once a minute writes ~1,440 rows/day on its own, so roughly 43k rows per user per month before pruning. `ACCESS_LOG_ENABLED=false` turns it off without touching the clients.

## API endpoints

All routes except health and the auth entry points require a bearer token.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health, database, and migration status |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/refresh` | Rotate tokens |
| `POST` | `/api/auth/logout` | Revoke a refresh token |
| `GET` | `/api/auth/me` | Current account |
| `DELETE` | `/api/auth/account` | Delete the account and all its data |
| `GET`/`PATCH` | `/api/profile` | Read/update profile |
| `GET`/`POST`/`DELETE` | `/api/contacts[/:id]` | Trusted contacts (max 5) |
| `POST`/`GET` | `/api/location`, `/api/location/latest`, `/api/location/history` | Location events |
| `POST`/`GET` | `/api/checkins` | Check-in history and missed count |
| `GET`/`PUT` | `/api/settings` | Check-in interval (5m–48h) and reminders |
| `GET` | `/api/feeds` | Community feed |
| `POST`/`DELETE` | `/api/push-tokens` | Expo push token registration |
| `GET`/`POST` | `/api/security/consent` | Read/record consent |
| `POST` | `/api/security/consent/withdraw` | Stop monitoring, erase location history |
| `GET` | `/api/security/activity` | The user's own sign-in and network log |
| `GET` | `/api/security/incidents` | Missed-check-in incidents |
| `POST`/`GET` | `/api/jobs/safety-sweep` | Scheduler only — `x-cron-secret` |
| `POST`/`GET` | `/api/jobs/prune` | Scheduler only — retention enforcement |

## Mobile build

**Expo Go cannot run this app's core feature.** Background location is stripped from Expo Go (unavailable on Android entirely), and Android push was removed in SDK 53. Expo Go is fine for UI and API work; verifying background monitoring needs a **development build**:

```bash
cd apps/mobile
npx expo-doctor                      # should report 21/21
npx expo config --type introspect    # inspect generated native permissions

eas login                            # your Expo account
eas init                             # assigns the project ID push tokens need
eas build --profile development --platform android
# install the resulting APK, then:
npx expo start --dev-client
```

Copy the project ID `eas init` prints into `apps/mobile/.env` as `EAS_PROJECT_ID`, otherwise push registration is skipped.

Background location requires the `expo-location` plugin flags in `app.json`, which generate iOS `UIBackgroundModes: [location]` and Android `ACCESS_BACKGROUND_LOCATION` / `FOREGROUND_SERVICE_LOCATION`. Google Play requires a review request for background location access.

Google Maps keys are optional during MVP — `app.config.js` only adds the `react-native-maps` plugin when `GOOGLE_MAPS_ANDROID_API_KEY` / `GOOGLE_MAPS_IOS_API_KEY` are set. Android store builds need the Android key for satellite imagery to render.

## Status

See `ARCHITECTURE-HANDOFF.md` for the full roadmap. In short: suitable for investor demos, internal testing, and device prototyping. **Not yet a substitute for an emergency service** — missed check-ins are still detected on the device, and trusted-contact escalation (Phase 3) is not built.
