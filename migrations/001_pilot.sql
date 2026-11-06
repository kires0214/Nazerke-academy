CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint NOT NULL UNIQUE,
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','blocked')),
 role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','ambassador','admin','techadmin')),
 telegram_opt_in boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz, approved_by uuid REFERENCES users(id)
);
CREATE TABLE admin_grants (
 user_id uuid NOT NULL REFERENCES users(id), permission text NOT NULL,
 granted_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, permission)
);
CREATE TABLE access_entitlements (
 user_id uuid NOT NULL REFERENCES users(id), scope text NOT NULL CHECK (scope IN ('academy','ambassador')),
 granted_by uuid REFERENCES users(id), PRIMARY KEY(user_id,scope)
);
CREATE TABLE devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 binding_hash text NOT NULL CHECK (length(binding_hash)=64), created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE UNIQUE INDEX one_registered_browser ON devices(user_id) WHERE revoked_at IS NULL;
CREATE TABLE sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 device_id uuid NOT NULL REFERENCES devices(id), token_hash text NOT NULL UNIQUE CHECK(length(token_hash)=64),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE UNIQUE INDEX one_active_session ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE TABLE login_receipts (hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE rate_limits (key text NOT NULL, bucket bigint NOT NULL, hits integer NOT NULL, PRIMARY KEY(key,bucket));
CREATE TABLE audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id),
 operation text NOT NULL, entity_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE TABLE content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('section','course','module','lesson','attachment','recipe','collection','post','material','event')),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'), title text NOT NULL, description text NOT NULL DEFAULT '',
 language text NOT NULL DEFAULT 'RU' CHECK(language IN ('RU','KZ')),
 audience text NOT NULL DEFAULT 'academy' CHECK(audience IN ('public','academy','ambassador')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','hidden','archived')),
 parent_id uuid REFERENCES content(id), sort_order integer NOT NULL DEFAULT 0,
 cover text, data jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1,
 created_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 CHECK(parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX content_catalog ON content(status,kind,sort_order);
CREATE INDEX content_parent_order ON content(parent_id,sort_order);
CREATE TABLE content_links (
 source_id uuid NOT NULL REFERENCES content(id), target_id uuid NOT NULL REFERENCES content(id),
 sort_order integer NOT NULL DEFAULT 0, PRIMARY KEY(source_id,target_id), CHECK(source_id<>target_id)
);
CREATE TABLE media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('image','document','video')),
 provider text NOT NULL CHECK(provider IN ('postgres','stream')), provider_id text UNIQUE, mime text,
 bytes bytea, state text NOT NULL CHECK(state IN ('uploading','processing','ready','failed')),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(bytes IS NULL OR octet_length(bytes)<=5000000)
);
CREATE TABLE content_media (
 content_id uuid NOT NULL REFERENCES content(id), media_id uuid NOT NULL REFERENCES media(id),
 PRIMARY KEY(content_id,media_id)
);
CREATE TABLE lesson_progress (
 user_id uuid NOT NULL REFERENCES users(id), lesson_id uuid NOT NULL REFERENCES content(id),
 position_seconds integer NOT NULL DEFAULT 0 CHECK(position_seconds BETWEEN 0 AND 86400), completed_at timestamptz,
 last_opened_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,lesson_id)
);
CREATE TABLE favorites (
 user_id uuid NOT NULL REFERENCES users(id), content_id uuid NOT NULL REFERENCES content(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,content_id)
);
CREATE TABLE event_registrations (
 user_id uuid NOT NULL REFERENCES users(id), event_id uuid NOT NULL REFERENCES content(id),
 status text NOT NULL CHECK(status IN ('registered','waitlist','cancelled')), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,event_id)
);
CREATE TABLE city_interests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 city text NOT NULL, topic text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE support_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES support_threads(id),
 actor_id uuid NOT NULL REFERENCES users(id), sender text NOT NULL CHECK(sender IN ('student','human')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_history ON support_messages(thread_id,created_at);
CREATE TABLE telegram_updates (update_id bigint PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id bigint NOT NULL, body text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 telegram_message_id bigint, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_due ON notification_outbox(state,next_attempt_at);
