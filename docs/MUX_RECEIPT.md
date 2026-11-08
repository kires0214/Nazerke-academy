# Mux migration DEV verification — 2026-11-08

Branch: `codex/mux-private-video`. Application/configuration revision: `a752d43dc1496a76841a85bf8489021166a9d1d3`. Parent implementation: `9d5a6195cb25e9cd0d65017d091aa3c75713bc76` (`codex/juicy-mvp`, PR #2). This receipt adds no application changes. The focused PR targets the open parent branch rather than duplicating the whole MVP diff against main; retarget after the parent is merged.

| Check | Observed result |
| --- | --- |
| `npm test` | PASS — 38 tests, 38 passed, 0 failed, 0 skipped |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run build` | PASS — Next.js production build with one build worker |
| `npm audit --omit=dev` | PASS — 0 production dependency vulnerabilities at execution |
| `npm run demo:verify-assets` | PASS — all 25 byte counts and SHA1s |
| Built-app HTTP smoke | PASS — 9 public pages, single headers, Academy/Studio guest redirects, private profile 401, preview switcher 404, all 25 HTTP assets match baseline |
| Client bundle inspection | PASS — no Mux server-credential variable names or retired video upload/player endpoints in built browser JavaScript |
| Local runtime cleanup | PASS — managed Next process/children stopped and port released; PGlite engines closed; no browser, REPL, container or optional local tool server launched |

## Video coverage

The integration suite uses real SQL in PGlite, explicitly mocked Mux HTTP responses and runtime-generated synthetic RSA keys. It runs the browser PUT helper with a synthetic Blob and the actual application API services through upload creation, verified processing/ready events, private content association and authorized signed playback. It cryptographically verifies the RS256 signature and Mux playback/key/audience/expiry claims. It confirms Basic 1080p, signed-only policy, exact upload origin and disabled DRM configuration.

Negative checks cover missing/forged/stale/future or altered-body webhook signatures; duplicate events; retry after provider failure without losing the event; late events after terminal failure; public/DRM/wrong-quality/wrong-resolution assets; missing signing configuration; unapproved and unentitled users/staff; a different browser; a revoked session; hidden content; a student attempting upload; and historical provider IDs being refused by the Mux adapter. Unauthorized viewers do not reach Mux or receive a JWT.

Expiry tests verify duration-aware leases cover a full lesson at 0.5x, long pauses require renewal, near-expiry sessions cannot mint a lease that outlives them, refreshed HLS requests receive the new token only on Mux hosts, and native-source replacement restores the same playhead and paused/playing state. Server rendering emits no video URL/JWT before access is requested. These helper/adapter tests do not claim a real Mux CDN decoded a video.

The pre-existing Telegram HMAC/replay, approval/RBAC, one registered browser/one active session, CMS, course progress, favorites, support and asset tests continue to pass. The original migration checksum remains unchanged. Migration 002 preserves retired provider rows and adds Mux fields/receipts; no real database migration was run in this task.

## Live acceptance still pending

The real Mux upload → encoding → webhook → CDN playback flow is **not verified** until the five server-side values in [MUX_SETUP.md](MUX_SETUP.md) are configured in DEV. The live read-only diagnostic is not proof of upload permission, key registration, callback delivery or browser playback. Real Telegram/mobile/device flows, backup/restore and customer-data qualification remain pilot gates. No actual Mux upload, API token, signing key, webhook, billing activation, Vercel secret change or Production deployment was performed by this task.

The Next.js/Vercel stack and existing Production deployment are preserved. Private runtime/account identifiers, ownership ledger and detailed local audit remain outside public Git. Release stays DEV → PROD only.
