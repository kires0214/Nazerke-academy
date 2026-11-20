# DEV setup for PR #2

Use Vercel Development for local DEV configuration and Preview scoped to `codex/juicy-mvp` or the focused `codex/mux-private-video` branch for hosted DEV. These are execution locations for DEV, not an extra TEST environment. Do not set or copy Production values.

The existing demo project must be connected to `kires0214/Nazerke-academy` before Vercel permits branch-scoped variables. Connecting Git must not initiate or promote a Production deployment. Keep the existing Production deployment and global build settings unchanged; use explicit Preview deployment settings for the Next.js branch. Do not create another project or enable automatic Production deployment as a workaround.

The feature branch supplies those deployment settings in `vercel.json`: Next.js, the existing install/build scripts and Frankfurt Functions beside the DEV database. Keep environment values in Vercel, outside this configuration file. Telegram and Mux values can remain absent while their setup is deferred; the app must fail closed for those unavailable integrations.

## Account-owned setup

1. Connect a separate Neon DEV resource through the approved Vercel team. Scope its connection string to DEV only. If the integration creates `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING`, explicitly map the selected DEV connection string to `DATABASE_URL`, which this application reads. Never share the Production database. Agent integration discovery may require account permissions not available to the current connection; complete that step in the provider/Vercel dashboard when needed.
2. Use a dedicated Telegram DEV bot. Store its BotFather token and username (without `@`) in Vercel. Generate a distinct random webhook secret with at least 32 characters from Telegram's `A-Z a-z 0-9 _ -` character set and save it in DEV as `TELEGRAM_WEBHOOK_SECRET`. Verify the hosted DEV origin, then use Telegram's `setWebhook` for `<DEV_ORIGIN>/api/telegram/webhook`, with the same value as `secret_token` and `allowed_updates: ["message"]`. Check `getWebhookInfo` first and retain queued updates. Use the dedicated DEV bot to avoid replacing another environment's webhook. The site exchanges bot codes through a same-origin POST to `/api/auth/telegram`. BotFather domain linking applies to the retired browser widget. For support, separately add the DEV support chat ID and add the bot to that chat.
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

Run migration 003 before deploying the invitation flow. In DEV, verify the bot receives a private join request and that sharing one's own contact creates only a review record. The operator verifies the first Tech Admin's Telegram ID against the trusted owner's request, sets `BOOTSTRAP_TECHADMIN_TELEGRAM_ID` temporarily for `npm run db:bootstrap-admin`, and removes the variable after success. The command also accepts a pre-existing eligible account for upgrades. It verifies there is no existing Tech Admin, records the promotion, and clears the applicant phone. The Tech Admin requests a code in Telegram and uses it on `/login`. In Studio, staff with `students.read` can review names and phone numbers, and those with `students.approve` can invite or decline. Review clears the phone. Keep DEV test data synthetic and restrict real onboarding to the approved release.

Apply migration 011 before deploying one-time invitations. Staff with `students.read` and `students.approve` create a link in **Studio → Доступ → Приглашения** and share it with the intended recipient. The link expires after seven days or after one submitted request, and staff can revoke an unused link. Both flows require the applicant's own Telegram contact and their first and last name. The public site flow additionally requires the store and order number. Both requests go to Studio for review and assignment of access. The old `TELEGRAM_REQUIRE_ORDER_DETAILS` key can be removed from the DEV Preview.

Exercise invites and expiry, browser/device checks, private Mux upload/playback, support roundtrip and backup/restore before a release. Confirm Production's serving deployment and environment metadata are unchanged during DEV setup.

The resource ledger, environment-variable IDs, native runtime identities and account-specific audit evidence stay local and outside public Git history.
