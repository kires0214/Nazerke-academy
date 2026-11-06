# DEV → PROD (Owner override)

Only two environments. DEV uses local development and Vercel branch Preview; the Vercel Preview mechanism is **DEV**, not a third TEST tier. PROD is production deployment from main. No Railway, VPS, separate TEST project, unnecessary CI pipeline.

1. Codex makes coherent commit on feature branch, runs unit/integration/E2E in DEV, records SHA and PASS/FAIL.
2. Open PR and review diffs, semantic images, RBAC, storage migrations.
3. When DEV passes and any consequential settings are authorized, merge/deploy PROD. No repeat approval questions for ordinary engineering fixes.
4. Run immediate PROD smoke (public UI, closed access denial/success, 4 owner photos, 21 images, course/recipe/media, admin security); rollback to prior Vercel deployment on regression.

DEV and PROD must not share Neon DB, Telegram credentials or Cloudflare secret keys. Do not put real PII in DEV. Backward-safe migrations and backup before destructive change. Keep previous READY deployment known. A green Vercel build alone is not evidence of backend correctness.

Current production demo: https://nazerke-academy-demo.vercel.app/ . Vercel project prj_vmCd6wkwTL6xTN8uyCBNk1kFHWE7; team orch-loopers; as inspected 2026-11-06 current deployment dpl_4XxYdQEjksdNu3BJADHpWpvcCXua. Before touching production re-read actual current deployment and confirm scope, allow rollback.
