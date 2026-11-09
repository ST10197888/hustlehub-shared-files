# Person 2 — Logging and Security Handover

## Scope

Implemented structured application logging, optional Better Stack cloud
delivery, persistent account login cooldowns, and server-side session
revocation.

The original assessment rubric still needs a final requirements check.
This document records the implementation and verification completed.

## Verification results

- Backend: 189 tests passed across 17 suites.
- Frontend: 51 tests passed across 10 suites.
- Frontend ESLint: passed.
- Frontend production build: passed.
- Latest production dependency audits: zero reported vulnerabilities
  for both backend and frontend.
- Full dependency audits still reported development-tool findings.
  The last reports showed 20 backend and 22 frontend findings.
  These require review with the CI/security workstream.
- No force-based dependency downgrade was applied.

## Structured logging

Winston emits JSON events locally and optionally to Better Stack.

Request events include a server-generated request ID, method, route
template, response status, duration, severity, and timestamp.
The request ID is also returned in the X-Request-ID response header.

Business events cover authentication, registration, bookings,
transactions, financial views, ownership denials, and failures.
Startup and database connection events are also recorded.

Examples include:

- auth.login.success
- auth.login.failure
- auth.login.blocked
- auth.logout.success
- auth.token.rejected
- booking.created
- transaction.recorded
- financial.summary.viewed
- security.rate_limit.denied
- http.request.completed
- http.request.error
- database.connected
- server.started

Only approved metadata fields are forwarded by the event logger.
Passwords, bearer tokens, email addresses, booking notes, financial
amounts, request bodies, and raw exception messages are excluded from
the structured event metadata.

Actor, booking, transaction, and request identifiers may be logged for
correlation. Logs must therefore still be access-controlled.

Cloud configuration and delivery failures use fixed, safe reasons.
The console destination remains available. Cloud delivery failures do
not prevent the API from enforcing authentication or rate limits.
Automated tests do not send logs to Better Stack.

## Additional control 1: persistent account cooldown

- Five failed logins within a 15-minute window start a 15-minute cooldown.
- State is stored in MongoDB using an HMAC-derived account key.
- Concurrent updates are handled atomically.
- Requests during an active cooldown do not extend its end time.
- Blocked responses use HTTP 429 and provide Retry-After information.
- Active cooldowns survive an application restart.
- Both /login and /api/auth/login enforce the control.

Cloud reasons distinguish:

- cooldown_started: the account reached the failure threshold.
- cooldown_active: the account is already locked temporarily.
- request_rate_limit: the separate request limiter denied the request.

Existing request limits remain 10 authentication, 20 booking, and
100 general requests per 15 minutes.

## Additional control 2: server-side session revocation

Issued tokens have an expiry, a unique session identifier, and fixed
issuer, audience, and signing-algorithm checks.

Authenticated logout persists revocation for the verified session.
Protected requests check revocation before granting access.
Revocation records use MongoDB expiry cleanup.

If the revocation lookup fails, protected access returns a safe 503.
The frontend waits for logout confirmation and supports retrying a
failed logout rather than falsely reporting success.

Live verification using the same token produced:

| Check | HTTP status |
|---|---:|
| Profile before logout | 200 |
| Authenticated logout | 200 |
| Profile after logout | 401 |

Better Stack recorded auth.token.rejected with reason session_revoked.

## Local setup

Keep real credentials in the backend's ignored .env file.

Use hustlehub-backend/.env.example as the backend configuration guide.
The frontend template contains VITE_API_URL=http://localhost:5000.

For the verified local setup:

- Backend port: 5000.
- Frontend origin: http://localhost:5173.
- MongoDB must be running.
- Development and test databases must be separate.
- The test database name must contain "test".
- Configure a private JWT_SECRET.

Optional backend cloud settings:

BETTER_STACK_ENABLED=false
BETTER_STACK_SOURCE_TOKEN=
BETTER_STACK_INGESTING_URL=

To enable cloud delivery, set BETTER_STACK_ENABLED=true and provide the
source token and full HTTPS ingesting URL from Better Stack.

Keep these settings in the backend. Never commit real source tokens
or place them in frontend VITE_ variables.

Run npm ci in each application folder before starting.

Backend:
- npm test
- npm audit --omit=dev
- npm start

Frontend:
- npm run lint
- npm test
- npm run build
- npm audit --omit=dev
- npm run dev -- --port 5173 --strictPort

## Live behaviour verified

- Better Stack received startup and HTTP request events.
- Unsupported routes produced a recorded HTTP 404.
- Freelancer registration and login worked.
- A freelancer created "Demo website design" priced at R500.
- A client booked that gig using simulated payment.
- The client saw one confirmed R500 booking.
- The freelancer dashboard showed R500 earnings, R0 estimated tax,
  and R500 net estimate for this demonstration.
- Better Stack received transaction.recorded and booking.created.
- The expanded booking event contained correlation identifiers and
  excluded the submitted booking notes.
- Incorrect credentials produced auth.login.failure.
- Account cooldown remained active after restarting the backend.
- A logged-out token was rejected with reason session_revoked.

The displayed tax result describes this demonstration, not a general
tax calculation validation.

## Evidence and final handover tasks

Place selected screenshots in docs/evidence/member2.

Include evidence of:
- Cloud event overview and expanded booking event.
- Booking confirmation and client booking history.
- Freelancer earnings dashboard.
- Failed-login event.
- Cooldown after application restart.
- Session revocation HTTP results and cloud rejection event.

Before final handover:
- Add the screenshots and an evidence index.
- Check the original assessment rubric.
- Review development dependency findings with Member 3.
- Review Git authorship and the current remote branch state.
- Push the reviewed commits to the correct group repository.

Member 4 can use the configuration notes for integration.
Member 5 can incorporate this handover into the final root README.