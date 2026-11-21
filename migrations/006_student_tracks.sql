ALTER TABLE access_entitlements DROP CONSTRAINT access_entitlements_scope_check;
ALTER TABLE access_entitlements ADD CONSTRAINT access_entitlements_scope_check CHECK(scope IN ('academy','kenwood','braun','ambassador'));
INSERT INTO access_entitlements(user_id,scope,granted_by)
SELECT user_id,'kenwood',granted_by FROM access_entitlements WHERE scope='academy'
ON CONFLICT DO NOTHING;
UPDATE users SET role='student' WHERE role='ambassador';
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('student','admin','techadmin'));
