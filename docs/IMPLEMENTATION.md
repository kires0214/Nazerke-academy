# Closed pilot implementation

Controlling issue: https://github.com/kires0214/Nazerke-academy/issues/1. DEV → PROD only. Public demo retained until gates pass.

## Server contracts

Every private API loads the current session, user status, registered browser, grants and entitlements from PostgreSQL inside a transaction. User/session/device share locks prevent concurrent grant/revocation writes from overtaking an authorized operation. Login takes a per-user update lock; partial unique indexes independently enforce one active browser and one unrevoked session. Expired sessions are rejected and replaced on the next successful same-browser login. Removing cookies requires an authorized device reset; logout retains browser binding.

Telegram invitations are approved in Studio. The verified webhook accepts one's own contact in a private chat. A request is stored separately from users, and an operator with `students.approve` opens the account. The bot issues five-minute login codes only to approved identities. Only the newest code hash is stored. The browser submits the code via same-origin POST and consumes it atomically with session creation. Cookie security and browser binding apply to the resulting session. Session/browser cookies are Secure + HttpOnly + SameSite=Lax in production.

CMS input schemas reject unknown fields, invalid parent kinds, invalid cross-links, unready media and public private-content types. Editing a published item requires publishing permission; version checks prevent lost updates. A recipe is one content row linked to multiple lessons/attachments/collections. Hiding a parent hides descendants. Archive preserves IDs/progress. Staff grants do not imply educational entitlement. Tech Admin alone manages staff grants and explicit staff learning access.

All SQL values are bound parameters. Rich content renders as escaped React text with paragraph/heading support; raw HTML is never executed. File types and size/dimensions are checked; PDF downloads force attachment and sandbox. Secrets, raw cookies, provider errors and Telegram login payloads are not logged by application code. Provider URLs containing tokens must also be redacted in platform access logging.

## Integrations and deployment configuration

Set separate DEV/PROD environment keys from .env.example. APP_BASE_URL is an exact trusted HTTPS origin in deployed builds. Use a Neon pooled connection string; TLS certificate verification is enforced. Each operation opens one bounded connection and closes it in finally; no idle pool. Start no Railway/VPS or persistent bot worker.

Vercel build: Next.js framework, install `npm ci`, build `npm run build`, Node >=22.13. Public assets are reconstructed by checksum on each clean build, never committed. Existing project remains static until a deliberate validated release. Do not commit `.vercel`, `.env.local` or binary media. Disable unintended automatic PROD deployment until release gates are satisfied.

Telegram webhook: POST `/api/telegram/webhook` with the configured secret token and allowed_updates `["message"]`. New visitors use `/start request`, invitees use `/start login` or `/login`. A bare `/start` enables notifications for approved users and offers the request menu to visitors. `/stop` opts out. The support group ID is a Vercel secret and `/reply <thread UUID> <text>` checks the sender's current role and grants. Incoming updates have unique receipts. Invitations and support messages use the existing outbox and bounded post-response delivery. Studio provides retry.

Mux: Basic quality capped at 1080p, direct browser PUT uploads, signed-only playback and no DRM. Upload URLs are origin-limited and expire after 15 minutes. Verified raw-body HMAC webhooks correlate upload/asset IDs, deduplicate event receipts transactionally and preserve terminal failures. Studio refresh rechecks the canonical provider asset. Token issuance first rechecks the current approved session/browser and linked content entitlement, then revalidates Mux privacy/quality. RS256 JWT expiry covers the full lesson at 0.5x plus pause headroom and cannot outlive the server session; near-expiry sessions must log in again. The player rechecks access every 30 seconds, renews without replacing the Hls.js player, and restores native-HLS playhead/state on source renewal. Existing bearer URLs cannot be revoked before expiry; no DRM, hardware binding or screen-recording prevention is promised. See MUX_SETUP.md for all keys, exact callbacks, migration and live gates.
## Remaining release gates

- Live DEV Neon migrations; independent-connection first-login races; recovery rehearsal using synthetic records; real backup/restore trial.
- Owner-controlled Telegram domain/bot/webhook setup and Mux account/token settings through Vercel secrets; live sign-in, notification/support and playback checks.
- DEV browser checks through a genuinely signed-in synthetic account, including second browser/phone, cookie reset and role denial. Local PGlite concurrency tests serialize transactions and cannot prove Neon connection interleavings.
- Privacy/localization/retention qualification before collecting real customer records. Current privacy copy explicitly remains preliminary; no claim of legal clearance.
- Review PR, preserve previous deployment ID, release validated commit to PROD, perform authenticated smoke and rollback on failure. Never treat READY alone as acceptance.

Current local verification and exact revisions are recorded in DEV_RECEIPT.md.
