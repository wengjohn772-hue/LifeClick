# LifeClick Architecture Handoff

This document records the current architecture, completed work, target platform, and remaining delivery tasks so development can resume without losing context.

## Current Status

LifeClick is a strong investor/demo MVP with an Expo mobile app that now builds, authenticates securely, and runs its safety loop correctly. It is **not yet ready for a public safety-service launch**: missed-check detection still runs on the device and trusted-contact escalation (Phase 3) does not exist.

Baseline commit before the hardening pass:

```text
c0a00ad Add native satellite map
```

Repository:

```text
https://github.com/wengjohn772-hue/LifeClick
```

## Repository Structure

```text
LifeClick/
  src/                         Vite React web MVP
  server/                      Express API and PostgreSQL schema
    index.js
    db/schema.sql
  api/                         Vercel serverless API handlers
  apps/mobile/                 Expo React Native iOS/Android app
    App.tsx
    lib/api.ts
    app.json
    eas.json
    assets/
  public web configuration
  README.md
```

The web app remains useful for investor demonstrations and internal testing. The mobile app is being added alongside it, not replacing it yet.

## Target Architecture

```text
Expo iOS/Android app
          |
          v
     Authenticated API
          |
    +-----+----------+
    |     |          |
 PostgreSQL Queue  Risk Engine
    |     |          |
    |     v          v
    |  Scheduler    Alerts
    |     |          |
    +-----+----------+
          v
 Push notifications / SMS / calls
          |
          v
 Trusted contacts and team admins
```

Long-term service layout:

```text
apps/web/       Investor web app and future admin UI
apps/mobile/    Expo iOS and Android app
packages/types/ Shared data types
packages/api/   Shared API contracts and client logic
packages/risk/  Shared risk scoring rules
server/         API, workers, schedulers, and database migrations
```

## Completed Web MVP

- Vite React TypeScript application
- Animated LifeClick splash logo
- Login and account creation screens
- Google OAuth URL foundation
- Profile management
- Built-in avatar selection
- FaF ID support
- Trusted contacts
- Check-in timer
- Personalized timing up to 48 hours
- Timer persistence across tab navigation
- Reminder state
- Feeds with anonymous user IDs
- FaF connection screen
- Safety dashboard
- Behaviour score bounded from 0 to 100
- Risk score and risk level
- Google satellite map integration
- Visible satellite-style fallback without a Google key
- Geolocation permission flow
- Live location marker
- Location persistence API
- Violet/black product branding
- Vercel API handler structure

## Completed Backend Foundation

- Express API in `server/index.js`
- PostgreSQL support using `pg`
- Neon-compatible `DATABASE_URL`
- Database schema in `server/db/schema.sql`
- Automatic schema initialization for MVP testing
- Vercel serverless API handlers
- Health endpoint
- Login endpoint
- Registration endpoint
- Location persistence endpoint
- Contacts endpoint
- Coordinate validation
- Profile fields for name, phone, address, and FaF ID
- Trusted-contact persistence during registration
- Database-unavailable demo fallback
- Same-origin production API behavior

## Completed Expo Foundation

Location:

```text
apps/mobile/
```

Completed:

- Expo TypeScript project
- LifeClick app name and slug
- iOS bundle ID: `com.lifeclick.app`
- Android package: `com.lifeclick.app`
- Native login and account creation
- Trusted-contact onboarding
- Native tab shell
- Check-in screen
- Persistent mobile timer
- FaF screen foundation
- Feeds screen foundation
- Safety dashboard foundation
- Settings screen
- Sign-out flow
- Expo Location
- Foreground location monitoring
- Background location task foundation
- Expo Notifications
- Scheduled local check-in reminders
- SecureStore session persistence
- Session restoration after app restart
- Session cleanup on sign-out
- React Native Maps
- Native satellite map
- Live location marker
- Coordinate fallback
- EAS development, preview, and production profiles

Validated:

- Expo TypeScript compilation
- Android Metro bundle
- iOS Metro bundle
- Expo configuration
- Native map bundling
- Native notification and location configuration

## Completed Hardening Pass (Phases 1 and 2)

### Build defects fixed

- `apps/mobile/eas.json` was invalid JSON (the root object was duplicated), so every `eas build` failed at parse. Rewritten with `cli.appVersionSource: "remote"`.
- The `expo-location` plugin lacked `isIosBackgroundLocationEnabled`, `isAndroidBackgroundLocationEnabled`, and `isAndroidForegroundServiceEnabled`. Background location was therefore inert on iOS and threw on Android 14+. Verified fixed via `expo config --type introspect`.
- The `react-native-maps` config plugin was absent, so the satellite map would render blank in a standalone Android build. Added, key-driven, in `app.config.js`.
- No `extra.eas.projectId`, so push tokens could not be attributed.
- `newArchEnabled` removed — not a valid SDK 57 property.
- `SafeAreaView` migrated to `react-native-safe-area-context`; the React Native one is a no-op on Android under edge-to-edge.

### Safety-loop defects fixed

- `missedClicks` was declared and never incremented, so Behaviour was permanently 100/100 and Risk permanently "Low". The dashboard was cosmetic.
- The check-in deadline was hardcoded to 30 minutes and lost on restart. It is now persisted, personalised (5m–48h), and **reconciled on relaunch**: intervals that elapsed while the app was closed are recorded as missed rather than silently forgotten.
- `scheduleReminder` called `cancelAllScheduledNotificationsAsync()`, wiping every scheduled notification. Reminders are now tracked and cancelled by identifier.
- A deadline under the reminder lead time clamped to one second and fired immediately. Now skipped.
- Background location was stopped in an effect cleanup, ending monitoring the moment the app left the foreground. Its lifetime is now scoped to sign-out.
- Foreground location writes are throttled to once a minute (was ~240 rows/hour/user).

### Authentication

- Passwords are hashed with bcrypt. Legacy plaintext rows upgrade transparently on next successful sign-in.
- Access tokens (JWT, 1h) plus rotating refresh tokens (30d) stored hashed in `auth_sessions`; both clients refresh transparently.
- Every private route is authorized and derives the user from the token.
- **Fixed auth bypass**: with no `DATABASE_URL`, login previously returned a valid session for any credentials. Demo mode is now gated behind `ALLOW_DEMO_AUTH=true`; otherwise the API fails closed with a 503.
- **Fixed IDOR**: `POST /api/location` trusted a body-supplied `userId`, letting any caller write location history against any account.
- Account deletion added, cascading to contacts, check-ins, locations, push tokens, and sessions.

### Data and infrastructure

- Auto-init replaced with a tracked migration runner. Migrations are JS modules, not a runtime `readFileSync` — Vercel's bundler could not trace the old file read, so schema init failed invisibly in production. Failures now surface in `/api/health`.
- `location_events.user_id` migrated from `VARCHAR` to `INTEGER` with a cascading foreign key; it could never be joined or cleaned up before.
- Indexes added on the hot paths; `push_tokens`, `auth_sessions`, and `feed_posts` tables added.
- CORS restricted to `ALLOWED_ORIGINS`; rate limiting on all routes with a tighter budget on auth; `zod` validation on every request body.
- Push-token registration and an Android notification channel added.
- The six per-route Vercel shims replaced by one function plus a `vercel.json` rewrite.

## Remaining Limitations

### Authentication

- Google OAuth is not fully verified server-side.
- Apple Sign In is not implemented.
- Password reset and email verification are not implemented.

### Safety Monitoring

- **Missed-check detection still runs on the device.** The OS can suspend the process; reconciliation happens on relaunch, not in real time.
- Backend-owned scheduling is not implemented.
- Trusted-contact calls, SMS, and escalation workers are not implemented.
- Push tokens are now stored, but nothing sends to them yet.

### Data and Infrastructure

- Retention policies are not yet defined.
- Location privacy, encryption, and audit policies need to be formalized.
- Production monitoring and alerting are pending.
- Rate limiting is in-process, so on serverless it is per-instance rather than global.

## Next Development Sequence

### Phase 1: Mobile data integration — COMPLETE

1. ~~Add mobile profile API methods.~~
2. ~~Add mobile trusted-contact API methods.~~
3. ~~Load real Feeds data from the API.~~
4. ~~Persist mobile check-ins.~~
5. ~~Persist mobile behaviour and risk scores.~~
6. ~~Add mobile personalized timer settings.~~

### Phase 2: Secure authentication — COMPLETE except OAuth

1. ~~Hash passwords with Argon2 or bcrypt.~~ (bcrypt, with transparent upgrade of legacy rows)
2. ~~Add secure sessions or JWT access tokens.~~
3. ~~Protect user-specific API routes.~~
4. ~~Add token refresh and expiration.~~ (rotating refresh tokens)
5. ~~Add account deletion.~~
6. Complete Google OAuth backend verification. **Outstanding.**
7. Add Apple Sign In for iOS. **Outstanding.**

### Phase 3: Backend-owned safety system

```text
Check-in deadline
       |
       v
Backend scheduler
       |
       v
Reminder notification
       |
       v
No response after grace period
       |
       v
Risk assessment worker
       |
       v
Trusted-contact escalation
```

Required services:

- Scheduler
- Queue
- Missed-check worker
- Risk engine
- Notification worker
- SMS/call provider
- Retry and idempotency handling
- Incident and audit records

AWS target:

```text
API Gateway or ALB
        |
     Lambda/ECS
        |
  RDS/Aurora PostgreSQL
        |
   SQS + EventBridge
        |
 SNS / Twilio / SES
        |
   CloudWatch / Sentry
```

### Phase 4: Admin dashboard

Add a separate application:

```text
apps/admin/
```

Features:

- Team authentication
- Role-based permissions
- Active user status
- Missed check-ins
- Risk levels
- Escalation status
- Trusted-contact responses
- Location visibility controls
- Incident timeline
- Team management
- Audit logs
- Reporting and exports

Suggested roles:

- Super admin
- Team admin
- Safety operator
- Read-only reviewer

### Phase 5: Store readiness

- Configure Expo EAS project identity
- Create development builds
- Test on physical Android devices
- Test on physical iPhones
- Add push credentials
- Verify background location behavior
- Verify notification behavior
- Create TestFlight build
- Create Google Play internal test
- Prepare production builds

## Environment Variables

Local development uses:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/lifeclick
PORT=4000
JWT_SECRET=                       # required in production; openssl rand -base64 48
ALLOWED_ORIGINS=http://localhost:5173
ALLOW_DEMO_AUTH=                  # leave unset; "true" accepts ANY credentials
VITE_API_BASE_URL=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_CLIENT_ID=
```

Expo mobile uses:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-production-api.example.com
EAS_PROJECT_ID=                   # from `eas init`; needed for push tokens
GOOGLE_MAPS_ANDROID_API_KEY=
GOOGLE_MAPS_IOS_API_KEY=
```

A device build pointed at `localhost` reaches the phone itself, not the dev machine. Use a LAN address or a deployed URL.

See `.env.example` and `apps/mobile/.env.example` for the annotated versions.

Vercel should use a hosted PostgreSQL URL. Never use `localhost` in Vercel environment variables.

Google Maps billing can remain suspended during MVP development. The mobile map has a native fallback, but production Google satellite imagery requires a configured provider and restricted API key.

## Launch Classification

### Suitable now

- Investor demonstrations
- Internal product reviews
- Early user testing
- Architecture validation
- Expo mobile prototyping
- Neon/PostgreSQL integration testing

### Not suitable yet

- Public emergency or safety-service commitments
- Guaranteed monitoring while the app is closed
- Production-scale authentication
- Unsupervised trusted-contact escalation
- Large-scale user growth without queueing and observability

## Definition of Full Launch

LifeClick is ready for a full iOS/Android launch when:

- Authentication is secure.
- Every private API route is authorized.
- Passwords are hashed.
- Backend schedulers own missed-check detection.
- Push notifications work on real devices.
- Escalation workflows are tested.
- PostgreSQL backups and migrations are operational.
- Admin roles and audit logs are active.
- Location privacy and retention rules are documented.
- Crash reporting and uptime monitoring are active.
- TestFlight and Google Play testing are complete.
- Privacy policy, terms, support, and account deletion are available.
