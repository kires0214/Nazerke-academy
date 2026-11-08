# Closed pilot implementation

Controlling issue: https://github.com/kires0214/Nazerke-academy/issues/1. DEV → PROD only. Public demo retained until gates pass.

## Server contracts

Every private API loads the current session, user status, registered browser, grants and entitlements from PostgreSQL inside a transaction. User/session/device share locks prevent concurrent grant/revocation writes from overtaking an authorized operation. Login takes a per-user update lock; partial unique indexes independently enforce one active browser and one unrevoked session. Expired sessions are rejected and replaced on the next successful same-browser login. Removing cookies requires an authorized device reset; logout retains browser binding.

Telegram official Login Widget HMAC is checked with a 5-minute auth_date window, signed-field allowlist and replay receipts. A random HttpOnly state cookie binds the callback to the initiating browser. The bot token selects the bot; configure the exact domain in BotFather. No client roles, JWT labels or preview switcher affect authorization. All mutations except the separately authenticated webhook require an exact configured Origin. Session/browser cookies are Secure + HttpOnly + SameSite=Lax in production; localhost development is the only insecure-cookie mode.

CMS input schemas reject unknown fields, invalid parent kinds, invalid cross-links, unready media and public private-content types. Editing a published item requires publishing permission; version checks prevent lost updates. A recipe is one content row linked to multiple lessons/attachments/collections. Hiding a parent hides descendants. Archive preserves IDs/progress. Staff grants do not imply educational entitlement. Tech Admin alone manages staff grants and explicit staff learning access.

All SQL values are bound parameters. Rich content renders as escaped React text with paragraph/heading support; raw HTML is never executed. File types and size/dimensions are checked; PDF downloads force attachment and sandbox. Secrets, raw cookies, provider errors and Telegram login payloads are not logged by application code. Provider URLs containing tokens must also be redacted in platform access logging.

## Integrations and deployment configuration

Set separate DEV/PROD environment keys from .env.example. APP_BASE_URL is an exact trusted HTTPS origin in deployed builds. Use a Neon pooled connection string; TLS certificate verification is enforced. Each operation opens one bounded connection and closes it in finally; no idle pool. Start no Railway/VPS or persistent bot worker.

Vercel build: Next.js framework, install `npm ci`, build `npm run build`, Node >=22.13. Public assets are reconstructed by checksum on each clean build, never committed. Existing project remains static until a deliberate validated release. Do not commit `.vercel`, `.env.local` or binary media. Disable unintended automatic PROD deployment until release gates are satisfied.

Telegram webhook: POST `/api/telegram/webhook`, configured secret_token (>=32 characters), allowed_updates `["message"]`. Verify BotFather domain before login. The support group ID is a Vercel secret. Staff reply `/reply <thread UUID> <text>` is authorized against the sender's current approved role/grants; membership in the Telegram group alone grants nothing. `/start` opts into notices; `/stop` opts out. Inbound updates have unique receipts; outbound delivery is at-least-once, so a crash after remote acceptance can duplicate a notice. Failed delivery preserves web support history. Successful mutation requests trigger a bounded post-response outbox batch. No cron/service is installed; Studio provides retry.

Mux: Basic quality capped at 1080p, direct browser PUT uploads, signed-only playback and no DRM. Upload URLs are origin-limited and expire after 15 minutes. Verified raw-body HMAC webhooks correlate upload/asset IDs, deduplicate event receipts transactionally and preserve terminal failures. Studio refresh rechecks the canonical provider asset. Token issuance first rechecks the current approved session/browser and linked content entitlement, then revalidates Mux privacy/quality. RS256 JWT expiry covers the full lesson at 0.5x plus pause headroom and cannot outlive the server session; near-expiry sessions must log in again. The player rechecks access every 30 seconds, renews without replacing the Hls.js player, and restores native-HLS playhead/state on source renewal. Existing bearer URLs cannot be revoked before expiry; no DRM, hardware binding or screen-recording prevention is promised. See MUX_SETUP.md for all keys, exact callbacks, migration and live gates.
## Remaining release gates

- Live DEV Neon migrations; independent-connection first-login races; recovery rehearsal using synthetic records; real backup/restore trial.
- Owner-controlled Telegram domain/bot/webhook setup and Mux account/token settings through Vercel secrets; live sign-in, notification/support and playback checks.
- DEV browser checks through a genuinely signed-in synthetic account, including second browser/phone, cookie reset and role denial. Local PGlite concurrency tests serialize transactions and cannot prove Neon connection interleavings.
- Privacy/localization/retention qualification before collecting real customer records. Current privacy copy explicitly remains preliminary; no claim of legal clearance.
- Review PR, preserve previous deployment ID, release validated commit to PROD, perform authenticated smoke and rollback on failure. Never treat READY alone as acceptance.

Current local verification and exact revisions are recorded in DEV_RECEIPT.md.
