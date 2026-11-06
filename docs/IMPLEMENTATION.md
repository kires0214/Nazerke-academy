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

Stream: direct uploads are private by default, origin-limited, and expire after 15 minutes. Video state refresh verifies requireSignedURLs and readiness. Playback checks authorization and provider privacy before requesting a non-downloadable 120-second viewer token. Revoked sessions cannot obtain new tokens; already issued tokens remain bearer credentials until expiry. No physical-device or anti-screen-recording guarantee is made. Provider media IDs are stored only server-side; upload resources are durable CMS assets. To remove an abandoned owned upload, verify its media row/provider UID, then delete that specific Stream asset through the authenticated provider API and audit the action. Never delete assets by a guessed UID.

## Remaining release gates

- Live DEV Neon migrations; independent-connection first-login races; recovery rehearsal using synthetic records; real backup/restore trial.
- Owner-controlled Telegram domain/bot/webhook setup and Stream account/token settings through Vercel secrets; live sign-in, notification/support and playback checks.
- DEV browser checks through a genuinely signed-in synthetic account, including second browser/phone, cookie reset and role denial. Local PGlite concurrency tests serialize transactions and cannot prove Neon connection interleavings.
- Privacy/localization/retention qualification before collecting real customer records. Current privacy copy explicitly remains preliminary; no claim of legal clearance.
- Review PR, preserve previous deployment ID, release validated commit to PROD, perform authenticated smoke and rollback on failure. Never treat READY alone as acceptance.

Current local verification and exact revisions are recorded in DEV_RECEIPT.md.
