# Codex execution plan — minimal vertical MVP

P0 Bootstrap now: verify HEAD and Issue #1; run static-demo asset sync + contract check; compare v3.2 pages and responsive visuals to current Vercel; create feature branch. Scaffold lean Next.js TypeScript without changing existing PROD; migrations for Neon DEV; DEV build+smoke. Output SHA/PR evidence.

P1 First real user: verified Telegram login, pending→approved, secure cookie session, one enrolled browser, server RBAC/grants, Tech Admin permissions. Negative and concurrency tests. No fake client roles.

P2 Real content: CMS sections/courses/modules/lessons/recipes/attachments/collections; media catalog, publish/preview/hide; cross-links one recipe per ID. Populate at least one real Kenwood lesson and recipe. Search/filter, favorites, progress.

P3 Private video and support: Cloudflare Stream protected playback and upload, Telegram webhook and notifications, web chat with staff response, events/waitlist. No extra server.

P4 Close pilot: DEV scenario matrix, mobile QA and security tests, controlled PROD smoke/rollback; approve small users, fix issues and ship.

Single Codex mutator. No repeated architecture or new goals. Short commits/PRs, exact test evidence. Ask Owner only for unavailable credentials, business choices or consequential external change. No idling while one integration is blocked.
