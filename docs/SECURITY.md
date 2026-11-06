# JUICY Academy — minimum threat/security contract

PUBLIC repo now: NO secrets, API tokens, Neon connection, Telegram bot tokens, Cloudflare credentials, real user data, unpublished course/video, production DB dumps in Git. Before storing proprietary/private media switch GitHub repository to PRIVATE (Owner settings). Assets already public on demo; import via asset sync script and checksums, do not rehost in public Git history by default.

Five roles: guest public; student approved content; ambassador student plus separate course; admin granular grants; techadmin assigns/revokes admin grants and manages system. No student/ambassador /admin. Backend protects endpoint even if UI hidden. Admin cannot add other admins, change their grants, self-upgrade or become techadmin. Staff grants and private educational access are separate. Audit every changes to role/grant, device/session, publication and access.

Core grants: content.edit, content.publish, content.delete, sections.manage, courses.manage, recipes.manage, media.upload, events.manage, support.read/respond, students.read/approve/block, devices.reset, ambassadors.assign, announcements.manage, analytics.read. Techadmin-only: admin/grants/system security. No direct client role switcher in PROD.

Telegram login: validate official signed data/hash and timestamp expiration, origin/bot identity and replay semantics. Server generates session only after validation; first-time status pending, never auto-entitled.

One enrolled browser + one active session, transactions with per-user lock/unique DB constraint. Cookie Secure+HttpOnly+SameSite, random token hash in DB. Check session revocation/expiry on protected API. Second browser must be denied or go through explicit admin reset; multiple tabs okay. Deleting cookie is not a free new-device enrollment. Do not advertise unbreakable physical-device binding/fingerprints.

Cloudflare Stream: signed short-lived playback issued only after verified session/content entitlement. Revoke/expiry denial, no permanent raw video URL. PDF/download same access checks. Screen recording cannot be fully prevented.

Threat tests: IDOR cross-user data, forged/replayed Telegram auth and webhooks, XSS/CSRF, second device race, session fixation/revocation, admin self-escalation, unapproved user bypass, video TTL, forged support ticket access. Log without secrets and minimum PII; rate-limit login, support and signup. Backups and recovery trial before pilot. Check Kazakhstan personal-data law and required consent/localization before real client records.

DEV has synthetic data and different credentials; PROD real clients. No separate TEST tier.
