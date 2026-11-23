# DEV implementation receipt — 2026-11-06

Historical receipt. Owner's 2026-11-08 Mux replacement supersedes the Cloudflare video setup and adapter evidence below; those original results are not live Mux acceptance. Current Mux configuration, migration and acceptance gates are documented in [MUX_SETUP.md](MUX_SETUP.md). Other baseline/Neon evidence is preserved unchanged.

Owner: CODEX_PRIMARY. Controlling issue: #1. Branch: `codex/juicy-mvp`.

Baseline: `4e781ac26db6dbe7542e5e0aac2e03fb1b268791`, verified before source changes.

Application revision: `4ff18e5507e0821417cf39fbe04c2fd586a2436f`. Its application files are byte-identical to the executed local revision. The connected GitHub app publishes commits because local HTTPS push has no credentials; no token was copied into the checkout. Follow-up receipt/CI/privacy changes do not change application source. The private task ledger and native runtime identifiers are excluded from the public history.

## Live Neon DEV continuation

Validated application/readiness revision: `6ae3b71faea5162269d767d3f22df581ffaab3db`. A separate Free-plan Neon DEV project was provisioned through the authenticated Neon connection. Its pooled `DATABASE_URL` is stored as a Sensitive variable in Vercel Development only. `APP_ENV`, the local `APP_BASE_URL`, and the independently generated webhook secret remain Development-only. No Production or Preview setting or deployment was changed.

| Real Neon check | Observed result |
| --- | --- |
| Actual migration runner, direct connection | PASS — two runs, one checksum-verified migration; source SHA-256 matches the recorded database checksum |
| Actual synthetic seed, two runs | PASS — 38 content items, 4 relationships; 0 retained users, media, events or notification jobs |
| Independent PostgreSQL connections | PASS — distinct simultaneous backend connections; competing first-browser logins leave one registered browser/session and reject the second browser |
| Concurrent logins in the registered browser | PASS — exactly one resulting session remains valid; the prior session is denied |
| Pending denial and manual approval service | PASS — synthetic pending identity denied, Tech Admin approval grants Academy access |
| CMS/RBAC and learning persistence | PASS — draft hidden, student publication denied, authorized publication persists; search, audience exclusion, lesson order, progress and favorites verified through separate transactions |
| Audit protection | PASS — attempted audit mutation rejected by PostgreSQL |
| Pooled application connection | PASS — existing read-only readiness command reports `NEON_CONNECTION=PASS` and `NEON_SCHEMA=PASS` |
| Fixture cleanup | PASS — isolated validation schema removed after ownership verification; database confirms no validation schema, retained account or application connection |

These checks called the actual migration, seed and backend services against hosted PostgreSQL. They did not exercise a real Telegram account, signed-in browser, Stream playback or support delivery. The overall provider-readiness result remains **BLOCKED** because Telegram and Cloudflare setup is explicitly deferred. The local readiness process did not load the webhook secret already stored in Vercel; its local missing-secret result does not mean that Vercel setting is absent.

The original CI on this application revision passed [31/31 tests, TypeScript, build, Linux HTTP smoke and dependency audit](https://github.com/kires0214/Nazerke-academy/actions/runs/42240888681). The live initialization and validation added no application source changes. Credentials, fixture identities and the private reproduction/audit script remain outside Git. The temporary credential file was removed, the local runtime exited, and the idle Neon compute was suspended and verified idle. The seeded DEV database and its Vercel secret are retained for continuing setup; a future query can resume compute.

The existing Vercel project is now connected to the approved GitHub repository, with `main` retained as its Production branch. CODEX_PRIMARY performed the link after a task-scoped account authorization; the serving Production deployment and global build/protection settings were verified unchanged. `APP_ENV=DEV` and the Sensitive Neon `DATABASE_URL` are also configured for Preview scoped only to `codex/juicy-mvp`. No credentials were broadened to all Preview branches.

The feature branch's `vercel.json` selects Next.js, the existing `npm ci` / `npm run build` commands and the Frankfurt function region beside Neon DEV. This configures branch deployments without changing global project settings or the currently serving Production app. Hosted `APP_BASE_URL` must use the actual verified DEV URL; the PR records the resulting deployment and smoke-check status. Telegram and Cloudflare remain explicitly deferred, including the hosted Telegram webhook secret. Real Telegram/Stream, authenticated browser/device flows and backup/restore remain acceptance gates. Production is unchanged.

## Executed in DEV

| Check | Observed result |
| --- | --- |
| Initial `npm run demo:assets` | PASS — 25/25 downloaded/verified |
| Initial `npm test` | PASS — unchanged v3.2 baseline contract |
| `npm run demo:verify-assets` | PASS — 25/25 SHA1 and byte counts |
| Final application `npm test` | PASS — 24 tests, 24 pass, 0 fail, 0 skipped; duration 22.29 s |
| `npm run typecheck` | PASS — strict TypeScript, no diagnostics |
| `npm run build` | PASS — Next.js 16.4.5 production build; one build worker |
| `npm audit --omit=dev` | PASS — found 0 vulnerabilities at execution time |
| HTTP smoke on built app | PASS — 9 public routes; Academy/Studio redirect guests to login; `/api/profile` 401; `/preview` 404 |
| HTTP assets | PASS — all 25 return 200 and original manifest SHA1/size |
| Edge browser | PASS — 375/430/768/1280 px, one header, no horizontal overflow, visible mobile navigation works, image decoding succeeds, no page errors |
| Portrait/asset inspection | PASS — 25 decoded assets, four independent portraits >=600px; desktop/mobile baseline and migrated screenshots retained outside public Git |

The automated suite executes actual SQL against an in-process PostgreSQL-compatible PGlite engine. Telegram/Cloudflare HTTP responses are mocked only in tests. The running app has no mock login, role switcher or simulated database fallback.

Coverage includes official Telegram HMAC/timestamp/forgery/replay checks; pending/blocked access; all business roles; staff grants separate from learning; Tech Admin-only grant management; session hashing/replacement/expiry/revocation; browser reset and uniqueness constraints; CMS draft/publish/hide/version/audit; canonical recipe cross-links; lesson order and progress; search/filter; favorites and support ownership; CSRF; webhook secret/idempotency; support human reply; notification failure/retry; private Stream TTL/privacy; authorized PDF signatures/expiry; event capacity; stored HTML escaping.

The original PGlite concurrency scenario serializes transactions. The later live Neon checks above cover independent first-browser and same-browser connection interleavings. Private shell rendering is checked by server-rendered component tests; authenticated browser flows remain a credentialed DEV gate.

## Failures repaired during execution

- Default npm cache was outside writable scope. Retried using checkout-local cache; no global npm settings changed.
- Initial JSX syntax errors were fixed before successful TypeScript/build verification.
- Browser harness failures (CIM permissions, process-not-found verification, lazy-image decoding and awaiting client navigation) were diagnosed and repaired. The final HTTP/browser run passed. Failed owned runtimes were verified stopped before reuse; no broad process termination was used.
- Event registration acquires the exclusive event row lock before catalog share locks to avoid a lock-upgrade race. Independent Neon contention remains a live check.

## External gates — not PASS

The Production reference deployment is preserved. Development-only Vercel values and a separate Neon DEV resource were created during setup as described above. No Production setting, deployment, bot, DNS or paid plan was changed.

Backup/restore, real Telegram domain/login/webhook/support delivery, real Stream upload/playback/expiry, signed-in mobile/device scenarios and PROD release smoke remain unverified. No real client data or private video was used. Real-customer privacy/retention qualification remains required. PROD was intentionally preserved because these release gates have not passed.

Next executable integration step: validate the hosted branch deployment and its exact DEV origin. When the Owner resumes Telegram and Cloudflare setup, walk verified Telegram login → manual approval → browser/session denial → CMS → learning/progress → Stream/support and rehearse restore. Only then review/merge and release DEV → PROD with immediate authenticated smoke and rollback available.

## Resource verification

The task-only browser, server, recorded children and temporary browser profile were verified stopped or removed; their listening port was released. The private resource ledger and audit screenshots remain local and are excluded from Git. No optional plugin/server setting was enabled, and no Docker/WSL/REPL/background service was launched. Disposable build/cache/export files are cleaned at the final stopping boundary; source, lockfile, dependencies, verified public media and local audit evidence are retained for unfinished integration work.
