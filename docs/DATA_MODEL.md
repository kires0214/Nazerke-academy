# Minimal PostgreSQL / Neon data model

Use migrations, constraints, FK, indexes, transactions. Avoid unnecessary LMS complexity. Data may be modelled via a lean ORM.

### Accounts/security
- users: id UUID, telegram_user_id BIGINT UNIQUE, display_name, status pending|approved|blocked, created_at, approved_at/by.
- user_roles: user_id, role student|ambassador|admin|techadmin, assigned_by/at.
- permission_definitions: key, description; admin_grants: admin_user_id, permission_key, granted_by/at, unique(user,permission).
- access_entitlements: user_id, program/resource, granted_by, revoked_at; learning access separate from staff grants.
- device_registrations: id,user_id,binding_hash,status,registered_at,revoked_at; partial UNIQUE active device per user.
- sessions: id,user_id,device_id,hashed_token,expires_at,revoked_at; atomic one active session per user.
- audit_events: id, actor, target, operation, entity_id, redacted metadata, created_at; append-only at app level.

### Content
- sections: id,parent_id,slug,title_ru/title_kz,description,sort_order,status.
- media_assets: id, kind image|document|video, provider, provider_id, processing_state, access_policy, mime_type, size.
- Mux video implementation extends `media` with unique `mux_upload_id` / `mux_playback_id`, duration and terminal-state marker; `provider_id` is the Mux asset ID. `mux_webhook_events` keeps only event ID/type/time for transactional deduplication. Historical provider IDs are retained, never converted into Mux IDs.
- courses: id,slug,title,description,cover_media_id,visibility/status.
- course_modules: id,course_id,title,sort_order.
- lessons: id,module_id,program kenwood|juicy|ambassador,slug,title,rich_content,sort_order,media_id,status.
- attachments: id,slug,model,photo_media_id,usage,assembly,care,mistakes,status.
- recipes: id,slug,title,category,duration_minutes,portions,ingredients,steps,kenwood_settings,cover_media_id,video_media_id,status,language.
- collections: id,slug,type cuisine|occasion,cover_media_id,shopping_list,prep_plan,status.
- recipe_attachments(recipe_id,attachment_id), collection_recipes(collection_id,recipe_id,sort_order), lesson_recipes(lesson_id,recipe_id) join tables; one canonical recipe/media used many times.
- lesson_progress(user_id,lesson_id,last_opened_at,completed_at,position_seconds) UNIQUE user+lesson.
- user_favorites(user_id,resource_type,resource_id) UNIQUE triple. Course progress derived from lessons; no duplication.

### Operations
- masterclasses(id,slug,city,starts_at nullable,capacity,status,cover_media_id,recording_media_id); registrations(user,masterclass,status registered|waitlist|cancelled) UNIQUE user/event; atomic cap.
- city_interests(user,city,topic,created_at).
- posts(id,kind article|news|offer|faq,slug,title,body,status,audience,published_at).
- support_threads(id,user_id,status,last_message_at), support_messages(id,thread_id,sender,origin,body,telegram_delivery_id).
- telegram_updates(bot_id,update_id,processed_at) UNIQUE bot+update, idempotency.
- notification_outbox(id,event,target,channel,state,attempts,payload_safe,created_at,next_attempt_at).

Indices status/published_at, lessons module/order, progress user/last_opened, recipe filters, sessions user/revoked, support status/time. Backend checks ownership and entitlement on each API. Soft archive instead of deleting published lesson IDs to preserve progress. Separate DEV/PROD DB and migrations.
