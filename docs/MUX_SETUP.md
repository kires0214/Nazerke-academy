# Mux private video setup

Owner override, 2026-11-08: Mux replaces Cloudflare Stream. Keep the existing Next.js/Vercel app, Neon, Telegram authentication, manual approval, granular grants and one registered browser/active session. DEV → PROD only. This change does not enable DRM or deploy Production.

## Required account and Vercel configuration

Use a dedicated Mux DEV environment. An account/environment alone does not supply API credentials. In Mux Video settings, create a Video API access token with **Read and Write** permissions. Create a playback URL signing key and retain its matching ID/private key; configure the webhook below and retain its endpoint signing secret. Each private value is shown only when created: store it directly in Vercel, never in chat, Git, PRs, shell arguments or browser variables.

| Vercel key | Type | Purpose |
| --- | --- | --- |
| `MUX_TOKEN_ID` | Secret | DEV Video API token identifier |
| `MUX_TOKEN_SECRET` | Secret | Matching DEV API token secret |
| `MUX_WEBHOOK_SIGNING_SECRET` | Secret | Secret of the exact DEV webhook endpoint |
| `MUX_SIGNING_KEY_ID` | Secret | Playback signing key identifier |
| `MUX_SIGNING_PRIVATE_KEY` | Secret | Base64-encoded RSA private PEM returned by Mux; raw PEM is also accepted server-side |
| `APP_ENV` | Config | `DEV` |
| `APP_BASE_URL` | Config | Exact verified HTTPS origin of this DEV branch |
| `DATABASE_URL` | Secret | Existing isolated Neon DEV pooled URL |

Keep existing Telegram keys as configured; no login provider or device/session policy changes. Scope these values to Vercel **Development**, and to **Preview for `codex/mux-private-video` only** when hosted DEV is deliberately configured. After the focused PR merges, the parent `codex/juicy-mvp` DEV deployment needs its own branch-scoped values. Do not broaden secrets to every Preview branch. Do not populate or modify Production during DEV setup. Redeploy DEV after changing values because old deployment snapshots do not receive them.

Signing keys must be RSA, at least 2048 bits. Never use `NEXT_PUBLIC_` for any Mux credential. HLS URLs and JWTs are returned only from an authorized, `private, no-store` API response and remain in client memory. Redact signed URLs from application/platform traces. There is no public signing/bootstrap endpoint and no role-switching demo login.

## Upload, processing and webhooks

An approved staff member with `media.upload` calls `POST /api/studio/media/mux`. The backend enforces the current session/browser/grant and exact Origin, then requests:

```json
{
  "cors_origin": "<APP_BASE_URL>",
  "timeout": 900,
  "new_asset_settings": {
    "playback_policies": ["signed"],
    "video_quality": "basic",
    "max_resolution_tier": "1080p",
    "master_access": "none",
    "passthrough": "<internal media UUID>"
  }
}
```

The browser uploads the raw file with `PUT` to the one-time Mux-provided Google Cloud Storage URL. It sends no JUICY cookies or Mux API credentials. Video bytes never pass through a Vercel Function. The pilot UI retains its 200 MB file limit; videos up to two hours are accepted. Leaving the upload page aborts the browser request. The unused direct-upload URL expires after 15 minutes; interrupted uploads can be retried with a new upload.

In the same Mux DEV environment, register **`POST <DEV_ORIGIN>/api/mux/webhook`** and subscribe to:

- `video.upload.asset_created`
- `video.upload.errored`, `video.upload.cancelled`, `video.upload.timed_out`
- `video.asset.ready`, `video.asset.errored`, `video.asset.deleted`

The endpoint must be reachable by Mux. Keep existing Vercel protection unchanged; check webhook delivery explicitly before claiming live acceptance. Account-owned access exceptions, if required, must be limited to the intended DEV webhook rather than disabling project protection.

The endpoint verifies `Mux-Signature` against **raw body bytes**, constant-time HMAC-SHA256 comparison and a five-minute timestamp tolerance. It does not require a student session or Origin header. It limits request size, records event ID/type transactionally, acknowledges duplicates, and rolls back the receipt on a processing failure so Mux can retry. Unknown/unmanaged events are ignored. Deleted, cancelled, timed-out or errored media cannot be resurrected by a delayed ready event.

Before readiness or token issuance, the server retrieves canonical asset details, checks upload ID/internal UUID correlation, Basic quality, resolution at or below 1080p and **only signed playback policies**. Public or DRM playback policies are rejected. Webhooks and the authorized Studio refresh route update `uploading → processing → ready/failed`; publication still requires ready media. No DRM configuration, DRM playback ID or license token is created.

## Private playback and expiry

`GET /api/media/<internal-media-UUID>/playback` first checks the actual server session, registered browser, approval, Academy entitlement and visibility of linked content including parents. Staff upload grants do not grant student viewing access. Pending/blocked users, another browser, revoked/expired sessions, hidden content and unentitled users are rejected **before calling Mux or signing**. Canonical provider privacy is rechecked before signing.

The response is an RS256-signed HLS URL with `aud=v`, the signed playback ID and the signing-key ID. The expiry covers the full lesson at 0.5x speed plus 15 minutes for pauses, with a minimum of 30 minutes and maximum of 4 hours 15 minutes. A session too close to its own expiry must log in again before starting the lesson; a playback token never outlives that session. This follows Mux's requirement that the JWT last beyond the video duration.

The player rechecks current access every 30 seconds and on returning to the page. It renews before the remaining lease can no longer cover the lesson. Hls.js updates subsequent signed Mux requests without replacing the player or clearing its buffer. Native HLS restores the same playhead and prior paused/playing state when replacing an expired/aging source. Error recovery offers continuation at the retained position. Requests, listeners, timers, uploads and HLS buffers are cleaned up when their component unmounts.

Revocation immediately denies new API access and new JWTs; the UI stops when its access check is denied. An already issued URL is still a bearer credential until expiry. DRM is disabled; browser binding does not make URLs hardware-bound or prevent copying/screen capture. Do not claim otherwise.

## Migration and rollback

Run the existing checksum-locked migration runner against the exact Neon DEV resource, using a direct/non-pooled connection for migration. `002_mux_video.sql` is additive apart from widening the provider constraint. It adds upload/playback IDs, duration, a terminal-state marker and webhook receipts. `001_pilot.sql` is unchanged.

Historical `provider='stream'` rows remain identifiable, with their IDs/content links preserved. They are **not** reinterpreted as Mux IDs and cannot play through the new adapter. Re-upload any historical video to Mux, wait for readiness, replace its content association through Studio, then retire only the verified old resource. There is no automatic destructive migration or provider deletion. The preceding app revision remains compatible with the expanded schema for rollback. Retired Cloudflare variables can be removed from DEV after verification; do not alter Production credentials.

## Verification and release gates

`npm test` uses actual SQL in PGlite, explicit mocked Mux HTTP and fresh synthetic RSA keys. It verifies browser PUT upload → processing → ready webhook → authorized signed playback, signature/timestamp/replay/correlation checks, retry/terminal handling, RSA signature/claims/expiry, authorization denials and playhead-preserving renewal. Existing Telegram/RBAC/browser/session tests continue to run. Mocks are not a runtime fallback.

Run `npm run dev:check-env` and `npm run dev:check-services` in the approved DEV environment. Diagnostics print only key names/fixed codes. The live probe lists one Mux asset read-only; it does not create an upload/key/webhook, prove write permission, confirm registered signing keys or establish browser playback. Missing integration setup reports BLOCKED. Never dump provider payloads or environment files.

Before pilot/PROD: run an actual synthetic video through browser upload, Mux processing, verified callback and signed playback; confirm a URL without a valid JWT is denied, expiry/long-pause continuation works, and a revoked/second-browser/unapproved user cannot obtain a fresh token. Complete real Telegram login/support, signed-in mobile checks, backup/restore and privacy qualification. Keep Production unchanged until the existing release gates pass, then deploy with smoke/rollback readiness.

Official references: [direct upload](https://www.mux.com/docs/guides/upload-files-directly), [Basic and resolution settings](https://www.mux.com/docs/api-reference/video/direct-uploads/create-direct-upload), [webhook verification](https://www.mux.com/docs/core/verify-webhook-signatures), [signed playback and expiry](https://www.mux.com/docs/guides/secure-video-playback), [CSP](https://www.mux.com/docs/core/content-security-policy).
