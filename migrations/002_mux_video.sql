-- Add Mux without rewriting any historical provider IDs or migration checksums.
-- Retired 'stream' rows remain identifiable and cannot play through the Mux adapter.
ALTER TABLE media DROP CONSTRAINT media_provider_check;
ALTER TABLE media ADD CONSTRAINT media_provider_check CHECK(provider IN ('postgres','stream','mux'));
ALTER TABLE media ADD COLUMN mux_upload_id text UNIQUE;
ALTER TABLE media ADD COLUMN mux_playback_id text UNIQUE;
ALTER TABLE media ADD COLUMN duration_seconds double precision CHECK(duration_seconds > 0 AND duration_seconds <= 7200);
ALTER TABLE media ADD COLUMN mux_terminal boolean NOT NULL DEFAULT false;
ALTER TABLE media ADD CONSTRAINT mux_video_kind CHECK(provider <> 'mux' OR kind='video');
ALTER TABLE media ADD CONSTRAINT mux_ready_details CHECK(provider <> 'mux' OR state <> 'ready' OR
  (provider_id IS NOT NULL AND mux_upload_id IS NOT NULL AND mux_playback_id IS NOT NULL AND duration_seconds IS NOT NULL AND NOT mux_terminal));
CREATE TABLE mux_webhook_events (
 event_id text PRIMARY KEY, event_type text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
