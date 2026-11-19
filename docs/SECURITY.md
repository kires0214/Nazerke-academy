# JUICY Academy — minimum threat/security contract

PUBLIC repo now: NO secrets, API tokens, Neon connection, Telegram bot tokens, Mux credentials, real user data, unpublished course/video, production DB dumps in Git. Before storing proprietary/private media switch GitHub repository to PRIVATE (Owner settings). Assets already public on demo; import via asset sync script and checksums, do not rehost in public Git history by default.

Five roles: guest public; student approved content; ambassador student plus separate course; admin granular grants; techadmin assigns/revokes admin grants and manages system. No student/ambassador /admin. Backend protects endpoint even if UI hidden. Admin cannot add other admins, change their grants, self-upgrade or become techadmin. Staff grants and private educational access are separate. Audit every changes to role/grant, device/session, publication and access.

Core grants include content.read/edit/publish/delete, per-kind content management, media.upload/delete, support.read/respond, students.read/approve/block, devices.reset, ambassadors.assign and audit.read. Only Tech Admin assigns staff roles and permissions and sees the full staff security audit. A regular admin with audit.read sees their own events and learner activity. Other users and admins without audit.read have neither a UI link nor API access.

Telegram access: accept private-chat updates only after verifying the configured webhook secret. Accept only the sender's own contact for an invitation request. Store the name and phone in the separate review queue and clear the phone at decision. Create an account only after staff grants the invitation. Issue a random five-minute code to an approved Telegram identity and keep its hash in PostgreSQL. Redeem it once through a same-origin POST under the existing browser and session rules.

One enrolled browser + one active session, transactions with per-user lock/unique DB constraint. Cookie Secure+HttpOnly+SameSite, random token hash in DB. Check session revocation/expiry on protected API. Second browser must be denied or go through explicit admin reset; multiple tabs okay. Deleting cookie is not a free new-device enrollment. Do not advertise unbreakable physical-device binding/fingerprints.

Mux Basic 1080p, DRM disabled: signed playback issued only after verified session/content entitlement; duration-aware tokens and renewal are documented in MUX_SETUP.md. Revoke/expiry denial, no permanent raw video URL. PDF/download same access checks. Screen recording cannot be fully prevented.

Threat tests cover cross-user access, forged Telegram webhooks, expired and replayed codes, XSS/CSRF, competing device/session requests, revoked access, admin self-escalation, private video and restricted support. Operational audit records approved users' visits to allowlisted Academy and Studio paths and authorized changes. Counts reflect navigation events received by the server. Store the actor, time and path without query strings, tokens, network addresses or message text. Audit history is append-only. Perform backups and recovery trials before the pilot.

DEV has synthetic data and different credentials; PROD real clients. No separate TEST tier.
