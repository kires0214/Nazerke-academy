# DEV setup for PR #2

Use Vercel Development for local DEV configuration and Preview scoped to `codex/juicy-mvp` or the focused `codex/mux-private-video` branch for hosted DEV. These are execution locations for DEV, not an extra TEST environment. Do not set or copy Production values.

The existing demo project must be connected to `kires0214/Nazerke-academy` before Vercel permits branch-scoped variables. Connecting Git must not initiate or promote a Production deployment. Keep the existing Production deployment and global build settings unchanged; use explicit Preview deployment settings for the Next.js branch. Do not create another project or enable automatic Production deployment as a workaround.

The feature branch supplies those deployment settings in `vercel.json`: Next.js, the existing install/build scripts and Frankfurt Functions beside the DEV database. Keep environment values in Vercel, outside this configuration file. Telegram and Mux values can remain absent while their setup is deferred; the app must fail closed for those unavailable integrations.

## Account-owned setup

1. Connect a separate Neon DEV resource through the approved Vercel team. Scope its connection string to DEV only. If the integration creates `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING`, explicitly map the selected DEV connection string to `DATABASE_URL`, which this application reads. Never share the Production database. Agent integration discovery may require account permissions not available to the current connection; complete that step in the provider/Vercel dashboard when needed.
2. Create or select a dedicated Telegram DEV bot using BotFather. Store its token, username without `@`, and DEV support chat ID in Vercel. Add the bot to that support chat. Once the actual public DEV origin is verified, set that exact domain in BotFather. The callback is `<DEV_ORIGIN>/api/auth/telegram`; the webhook is `<DEV_ORIGIN>/api/telegram/webhook`. Configure `secret_token` using the DEV webhook secret and `allowed_updates: ["message"]`; retain queued updates rather than dropping them. Inspect an existing webhook before replacing it; a Production webhook must never be replaced during DEV setup.
3. Configure the approved Mux DEV environment using [MUX_SETUP.md](MUX_SETUP.md): Video Read/Write API token, matching RSA playback signing key and verified webhook at `/api/mux/webhook`. Persist all five Mux values below as Secrets. Basic quality, maximum 1080p and signed-only playback are enforced by code; DRM is disabled. Account/billing activation stays Owner-controlled. Do not change Production videos/settings.

Store values directly in [Vercel environment settings](https://vercel.com/orch-loopers/nazerke-academy-demo/settings/environment-variables). Do not paste credentials into chat, issue comments, PRs, shell arguments or tracked files.

| Key | Type | Development value / hosted DEV requirement |
| --- | --- | --- |
| `APP_ENV` | Config | `DEV` |
| `APP_BASE_URL` | Config | Local: `http://localhost:3000`; branch Preview: the verified public HTTPS DEV origin |
| `DATABASE_URL` | Secret | Separate Neon DEV connection string |
| `TELEGRAM_BOT_TOKEN` | Secret | Dedicated DEV bot token |
| `TELEGRAM_LOGIN_BOT_NAME` | Config | That bot's exact username, without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret | Independently generated 32-byte random value, never copied from Production |
| `TELEGRAM_SUPPORT_CHAT_ID` | Secret | Approved DEV support chat only |
| `MUX_TOKEN_ID` | Secret | DEV Video API token identifier |
| `MUX_TOKEN_SECRET` | Secret | Matching DEV Video API token secret |
| `MUX_WEBHOOK_SIGNING_SECRET` | Secret | Secret of the exact DEV Mux webhook endpoint |
| `MUX_SIGNING_KEY_ID` | Secret | Mux playback signing key ID |
| `MUX_SIGNING_PRIVATE_KEY` | Secret | Matching base64-encoded RSA private PEM |

Use write-once Secret/Sensitive storage for credentials. Create branch Preview values only after Git is connected and only for the branch being exercised; never broaden credentials to every Preview branch. Existing deployment snapshots are not updated by saving environment variables; a new DEV deployment must receive the completed configuration. Keep deferred integrations absent until their setup is resumed.

## Readiness checks

`npm run dev:check-env` checks the **current process environment**, reports key names/fixed status codes only, and makes no external request. Exit codes: 0 = check passed; 2 = required setup missing; 1 = invalid/unsafe configuration.

`npm run dev:check-services` additionally performs bounded read-only checks: Neon connectivity/schema presence, Telegram `getMe` identity and `getWebhookInfo` target, and Mux read access. An available provider can be checked while another remains unconfigured. There are no migrations, webhook changes, notifications, uploads, payments or deployments in this command. Database connections close in `finally` and HTTP calls time out. Production targets/origins, an unverified Preview branch, or public secret prefixes prevent live probes.

After authenticating and linking the CLI to the approved project, inject Development values without putting them in command arguments:

```sh
vercel env run -e development -- npm run dev:check-env
vercel env run -e development -- npm run dev:check-services
```

If local environment files are deliberately used instead, keep them ignored and load them explicitly:

```sh
node --env-file=.env.local --import tsx scripts/check-dev.ts --live
```

Do not assume that pulling Secret values reproduces all hosted credentials. Do not dump `.env.local` or provider error payloads to logs. A format check is not provider authentication. Mux read success does not prove upload permission; a registered webhook target does not prove its secret or support delivery; schema presence does not prove migration checksums or backup recovery.

## Initialization and live acceptance

Neon initialization and SQL/backend checks can proceed independently of the Git link, Telegram and Mux. Verify the exact separate DEV resource first, use its direct/non-pooled connection for the existing migration runner, and use its pooled connection as the application's Vercel `DATABASE_URL`. Run the DEV-only synthetic seed with `APP_ENV=DEV`. Do not run initialization against Production. Re-running migrations must verify checksums; re-running seed must preserve content/relationship counts. See [the live DEV receipt](DEV_RECEIPT.md#live-neon-dev-continuation) for the completed checks.

After the Git link and remaining DEV values are ready, perform verified Telegram login, initial Tech Admin bootstrap, manual approval, authenticated browser/device tests, private Mux upload/playback, support roundtrip and a backup/restore rehearsal. Database-service acceptance alone does not prove the browser/provider flow. Register the webhook only after the DEV application and its public URL are verified. Confirm Production's serving deployment and environment metadata are unchanged before and after setup.

The resource ledger, environment-variable IDs, native runtime identities and account-specific audit evidence stay local and outside public Git history.
