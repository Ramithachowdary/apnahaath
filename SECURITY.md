# Security — ApnaHaath (Catalyst hackathon demo)

## Scope

Fictional patient demo. **Not** a production health product. No DPDP / HIPAA / CDSCO claims.

## Controls

- **HMAC-signed** session cookies (`SESSION_SECRET`, min 16 chars in production)
- Passwords and PINs stored as **bcrypt hashes** only; invite codes as SHA-256 hashes (single-use, 48 h)
- Server-side role checks on every API route; re-auth passcode before authoring
- Per-role lockout after 5 failed passcode attempts (5 minutes)
- zod validation on every mutating API body; session required for event log, proposals and outbox
- Security headers (CSP, frame deny, nosniff)
- Gemini responses validated as warn-only (no prescription mutation)
- **Reset**: requires `RESET_ADMIN_CODE` (never returned by APIs/UI); rate-limited to 1/minute; reseeds fictional demo only
- Secrets via env: `SESSION_SECRET`, `RESET_ADMIN_CODE`, `GEMINI_API_KEY`, `SMTP_USER`, `SMTP_PASS`

## Demo-only judge codes

Elder / caretaker / family defaults may appear on the landing page, labelled **demo-only**, for hackathon judges. They are not production credentials.

## Storage

`/tmp` SQLite on Render/Cloud Run is ephemeral and reseeds on cold start.

## Emergency

Cards and emails include **call 108**. The app does not triage emergencies.
