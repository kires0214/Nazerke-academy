# JUICY Academy / Codex operator instructions

You are CODEX_PRIMARY: the sole source-code mutator after bootstrap. Read GitHub Issue #1, README.md and docs/ before any source changes. Scope and product decisions are locked; do not reopen routine architecture.

MANDATORY: one Next.js app on Vercel, DEV → PROD (NO separate TEST environment), Neon PostgreSQL, Mux for protected video, Telegram login/bot through Vercel Functions. No checkout/payments/CRM/subscriptions or extra always-on server. Preserve current demo until parity is proven.

The repo currently starts as a static Vercel v3.2 archive. First run npm run demo:assets, npm run demo:check, review existing UX and asset manifest, create your own working branch, then immediately implement Next.js real backend vertical slice. Code changes in short coherent commits with PR. No architecture-only repetition; resolve engineering problems independently.

5 roles: guest, student, ambassador, admin with TECHADMIN-assigned granular grants, techadmin. Validate ALL permissions on backend. Client demo role switcher and localStorage never count as authentication. One registered browser + one server session per client, atomic PostgreSQL enforcement; do not falsely claim unbreakable hardware binding. Private Mux URLs must be signed after server authorization.

Brand: public JUICY by Nazerke, student JUICY Academy, admin JUICY Studio; never dual header. Four owner-provided original photos, no image generation or sprite. Actual Kenwood attachments in equipment cards; actual dishes in recipes. Approved design primary #DBADBA, hover #CA96A6, pressed #B98296, readable dark ink #352C31. Preserve media and content mapping in docs/CONTENT_MAP.md.

PUBLIC repo: no secrets/PII/proprietary unpublished materials. Use separate DEV/PROD credentials. Verify no client data in tests. For consequential release/security changes, follow Owner authority, but do not ask Owner every time for routine development.

Report actual branch/commit SHA, changes, DEV tests PASS/FAIL, next concrete step, external blockers only. No fake PASS and no indefinite planning.
