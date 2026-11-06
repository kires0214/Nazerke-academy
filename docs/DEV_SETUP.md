# DEV setup for PR #2

Use Vercel Development for local DEV configuration and Preview scoped to `codex/juicy-mvp` for hosted DEV. These are two execution locations for DEV, not an extra TEST environment. Do not set or copy Production values.

The existing demo project must be connected to `kires0214/Nazerke-academy` before Vercel permits branch-scoped variables. Connecting Git must not initiate or promote a Production deployment. Keep the existing Production deployment and global build settings unchanged; use explicit Preview deployment settings for the Next.js branch. Do not create another project or enable automatic Production deployment as a workaround.

## Account-owned setup

1. Connect a separate Neon DEV resource through the approved Vercel team. Scope its connection string to DEV only. If the integration creates `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING`, explicitly map the selected DEV connection string to `DATABASE_URL`, which this application reads. Never share the Production database. Agent integration discovery may require account permissions not available to the current connection; complete that step in the provider/Vercel dashboard when needed.
2. Create or select a dedicated Telegram DEV bot using BotFather. Store its token, username without `@`, and DEV support chat ID in Vercel. Add the bot to that support chat. Once the actual public DEV origin is verified, set that exact domain in BotFather. The callback is `<DEV_ORIGIN>/api/auth/telegram`; the webhook is `<DEV_ORIGIN>/api/telegram/webhook`. Configure `secret_token` using the DEV webhook secret and `allowed_updates: ["message"]`; retain queued updates rather than dropping them. Inspect an existing webhook before replacing it; a Production webhook must never be replaced during DEV setup.
3. Enable Cloudflare Stream on the approved account if necessary. Account/billing activation is Owner-controlled. Create a dedicated DEV token with the selected account's Stream Read/Edit permissions. Keep DEV videos and credentials separate from Production. New uploads must require signed URLs; do not change existing Production videos.

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
| `CLOUDFLARE_ACCOUNT_ID` | Config | Approved account with Stream enabled |
| `CLOUDFLARE_STREAM_API_TOKEN` | Secret | Dedicated DEV token |

Use write-once Secret/Sensitive storage for credentials. Create branch Preview values only after Git is connected. Never broaden branch credentials to every Preview branch to bypass a failed branch-scoped write. Existing deployment snapshots are not updated by saving environment variables; a new DEV deployment must receive the completed configuration.

## Readiness checks

`npm run dev:check-env` checks the **current process environment**, reports key names/fixed status codes only, and makes no external request. Exit codes: 0 = check passed; 2 = required setup missing; 1 = invalid/unsafe configuration.

`npm run dev:check-services` additionally performs bounded read-only checks: Neon connectivity/schema presence, Telegram `getMe` identity and `getWebhookInfo` target, and Cloudflare Stream read access. An available provider can be checked while another remains unconfigured. There are no migrations, webhook changes, notifications, uploads, payments or deployments in this command. Database connections close in `finally` and HTTP calls time out. Production targets/origins, an unverified Preview branch, or public secret prefixes prevent live probes.

After authenticating and linking the CLI to the approved project, inject Development values without putting them in command arguments:

```sh
vercel env run -e development -- npm run dev:check-env
vercel env run -e development -- npm run dev:check-services
```

If local environment files are deliberately used instead, keep them ignored and load them explicitly:

```sh
node --env-file=.env.local --import tsx scripts/check-dev.ts --live
```

Do not assume that pulling Secret values reproduces all hosted credentials. Do not dump `.env.local` or provider error payloads to logs. A format check is not provider authentication. Stream read success does not prove upload permission; a registered webhook target does not prove its secret or support delivery; schema presence does not prove migration checksums or backup recovery.

## Initialization and live acceptance

After the exact project is linked and required DEV values are verified, run existing migrations and the DEV-only synthetic seed with that environment. Do not run them against Production. Then perform verified Telegram login, initial Tech Admin bootstrap, manual approval, independent-connection browser/session races, CMS persistence/progress/favorites, private Stream upload/playback, support roundtrip and a backup/restore rehearsal. Register the webhook only after the DEV application and its public URL are verified. Confirm Production's serving deployment and environment metadata are unchanged before and after setup.

The resource ledger, environment-variable IDs, native runtime identities and account-specific audit evidence stay local and outside public Git history.
