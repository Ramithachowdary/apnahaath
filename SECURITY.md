# Security — ApnaHaath

## Scope

Hackathon project. **Not** a certified health product: no DPDP, HIPAA or CDSCO claims, and no third-party security audit.

## Reporting

Please open a private security advisory on the GitHub repository (or contact the maintainer) instead of a public issue.

## Controls in place

| Area                | Control                                                                                                                                                                                                                                                                                                                                                                                                   | Where                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Sessions            | HMAC-SHA256 signed cookie (`SESSION_SECRET`, ≥16 chars, required in production), HttpOnly, SameSite=Lax, Secure in production, 8 h expiry. Role is **never** read from the cookie                                                                                                                                                                                                                         | `src/lib/auth.ts`                                           |
| Sign-up             | Email ownership proven with a 6-digit code (SHA-256 hashed, 10-minute expiry, 5 attempts, 60 s resend cooldown, no session until verified; the code is never returned by the API in production). **Google sign-in** uses the OAuth 2.0 code flow with a random `state` cookie and a fixed `APP_URL` redirect URI; only Google-verified emails are accepted and linked                                     | `src/lib/otp.ts`, `src/lib/google.ts`, `src/app/api/auth/*` |
| Passwords / PINs    | bcrypt hashes only; per-account login lockout (5 tries) and per-membership PIN lockout (5 tries / 5 min), stored in the database                                                                                                                                                                                                                                                                          | `src/lib/auth.ts`                                           |
| Authorisation       | Every API route calls `requireMember(roles)`; role comes from the `memberships` row; every query is scoped by `household_id`                                                                                                                                                                                                                                                                              | `src/app/api/**`                                            |
| Invites             | Single-use, 48 h expiry, only the SHA-256 hash is stored, role assigned server-side                                                                                                                                                                                                                                                                                                                       | `src/app/api/invites*`                                      |
| One-tap email links | HMAC-signed (key derived from `SESSION_SECRET`), 6 h expiry, single use (claimed atomically in the DB), bound to one member + household + dose; role re-checked from the DB. **Only the elder's own link counts as "taken"**; anyone else's is recorded as a witness. `GET` never changes data (mail scanners prefetch links) — a button `POST`s. Personal links are kept out of the shared in-app outbox | `src/lib/doselink.ts`, `src/app/api/doses/link/route.ts`    |
| Input validation    | zod schemas on every mutating body                                                                                                                                                                                                                                                                                                                                                                        | `src/lib/validate.ts`                                       |
| Rate limits         | Per-IP: sign-up 10 / 10 min, code checks 30 / 10 min, resends 10 / 10 min (in-memory per instance)                                                                                                                                                                                                                                                                                                        | `src/lib/ratelimit.ts`                                      |
| Headers             | CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, COOP, Permissions-Policy, `no-store` on API                                                                                                                                                                                                                                                                                                                | `src/middleware.ts`                                         |
| Errors              | Health check returns a generic `Database unavailable`; details only in server logs                                                                                                                                                                                                                                                                                                                        | `src/app/api/health/route.ts`                               |
| AI safety           | Gemini / Adaption output is schema-validated and rejected if it tries to start, stop or change a dose (`rejectsMutation`), with template fallbacks                                                                                                                                                                                                                                                        | `src/lib/gemini.ts`, `src/lib/adaption.ts`                  |

## Data storage

- **Postgres on Neon** (`DATABASE_URL`, TLS) via the `@neondatabase/serverless` HTTP driver; any other Postgres works through `pg`. Tables are created idempotently; nothing is auto-wiped.
- Without `DATABASE_URL` (local dev / tests) an in-process PGlite database is used.
- Timestamps are stored as IST ISO-8601 text. The care-event log is append-only.

## Secrets

All secrets come from environment variables (`SESSION_SECRET`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `ADAPTION_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`). `.env*` files are git-ignored; `.env.example` has placeholders only.

## Known limitations

- In-memory rate limits reset when a serverless instance recycles.
- A forwarded elder email could be used by whoever holds it (single use, 6 h expiry limit the impact).
- `npm audit` reports a moderate PostCSS advisory that is fixed only in Next.js 16; not upgraded during the hackathon.

## Emergency

Every AI card and email includes **call 108**. The app does not triage emergencies.
