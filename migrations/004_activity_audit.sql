ALTER TABLE audit_events ADD COLUMN actor_role text
  CHECK (actor_role IN ('student','ambassador','admin','techadmin'));

CREATE INDEX audit_events_recent ON audit_events(created_at DESC,id DESC);
CREATE INDEX audit_events_actor_recent ON audit_events(actor_id,created_at DESC);
