# Acceptance checklist — JUICY Academy MVP

Every PASS requires actual evidence from DEV (exact SHA, test output) and PROD smoke after release. Legacy demo localStorage tests are NOT backend acceptance.

| Scenario | Acceptance |
|---|---|
| Public pages | Single public header, correct hero About/Articles/Events/Contacts, no broken links |
| Academy UI | One academy header, no public double menu, profile via avatar, mobile 375/430/768/1280 |
| Images | Four exact owner photos sharp; 21 topical images valid/200 and correct equipment/dish |
| Content | Kenwood exactly 10 ordered lessons; courses/modules and recipe cross-links persist |
| Recipe filters | Category, attachment, time, RU/KZ plus search; same recipe ID across collections |
| Progress | Start-or-continue logic, completed lesson, favorites persist after relogin |
| CMS | Create draft, edit, attach media, publish/unpublish; persists in DB |
| CMS denial | Admin without publishing grant receives 403 on direct request |
| Student role | Cannot read admin or other user's progress/support, even by URL |
| Ambassador role | Student denied protected ambassador lessons; ambassador allowed |
| Techadmin RBAC | Techadmin grant updates audited; normal admin cannot self-elevate |
| Telegram login | Valid signed data allowed; forged/stale/replayed auth denied |
| Approval | Pending/blocked users do not receive private content/signed media |
| Device | 2 parallel first logins allow 1; second browser denied; admin reset audited |
| Logout | Revoked token denied immediately for API and private media |
| Video | Correct Mux signed viewing for authorized user; unauthorized and expired denied |
| Documents | Protected file signed only for appropriate user |
| Support | Student message saved and admin reply delivered; Telegram retry idempotent |
| Events | Actual city/time/capacity, waitlist transaction safe, no invented schedule |
| Media safety | No external image 403, broken cards or wrong semantic photo |
| OPS | DEV build/tests, PROD smoke and rollback route; no PII in DEV |
| Pilot | Privacy qualification, backup/recovery, basic performance, 1 real vertical flow |

If external Telegram/Mux credentials missing, mark integration BLOCKED, not PASS, and continue unaffected features. No third TEST environment.
