# DEV implementation receipt — 2026-11-06

Owner: CODEX_PRIMARY. Controlling issue: #1. Branch: `codex/juicy-mvp`.

Baseline: `4e781ac26db6dbe7542e5e0aac2e03fb1b268791`, verified before source changes.

Application revision: `4ff18e5507e0821417cf39fbe04c2fd586a2436f`. Its application files are byte-identical to the executed local revision. The connected GitHub app publishes commits because local HTTPS push has no credentials; no token was copied into the checkout. Follow-up receipt/CI/privacy changes do not change application source. The private task ledger and native runtime identifiers are excluded from the public history.

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

The PGlite concurrency scenario serializes transactions. It verifies the service logic and constraints, not independent Neon connection interleavings. Private shell rendering is checked by server-rendered component tests; authenticated browser flows remain a credentialed DEV gate.

## Failures repaired during execution

- Default npm cache was outside writable scope. Retried using checkout-local cache; no global npm settings changed.
- Initial JSX syntax errors were fixed before successful TypeScript/build verification.
- Browser harness failures (CIM permissions, process-not-found verification, lazy-image decoding and awaiting client navigation) were diagnosed and repaired. The final HTTP/browser run passed. Failed owned runtimes were verified stopped before reuse; no broad process termination was used.
- Event registration acquires the exclusive event row lock before catalog share locks to avoid a lock-upgrade race. Independent Neon contention remains a live check.

## External gates — not PASS

The existing Vercel reference project was read only: `prj_vmCd6wkwTL6xTN8uyCBNk1kFHWE7`, team `orch-loopers`, current production deployment `dpl_4XxYdQEjksdNu3BJADHpWpvcCXua`. Its environment list was empty. No deployment, database, bot, provider account, DNS or paid resource was created or modified.

Live Neon connectivity/migrations/races/backup restore, real Telegram domain/login/webhook/support delivery, real Stream upload/playback/expiry, signed-in mobile/device scenarios and PROD smoke remain unverified. No real client data or private video was used. Real-customer privacy/retention qualification remains required. PROD was intentionally preserved because these release gates have not passed.

Next executable integration step: configure the separate DEV keys from `.env.example` through Vercel, link the existing approved project for DEV, verify key names without printing values, run DEV migrations and synthetic seed, then walk verified Telegram login → manual approval → browser/session denial → CMS → learning/progress → Stream/support. Only then review/merge and release DEV → PROD with immediate authenticated smoke and the recorded previous deployment available for rollback.

## Resource verification

The task-only browser, server, recorded children and temporary browser profile were verified stopped or removed; their listening port was released. The private resource ledger and audit screenshots remain local and are excluded from Git. No optional plugin/server setting was enabled, and no Docker/WSL/REPL/background service was launched. Disposable build/cache/export files are cleaned at the final stopping boundary; source, lockfile, dependencies, verified public media and local audit evidence are retained for unfinished integration work.
