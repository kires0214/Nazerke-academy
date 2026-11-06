# JUICY Academy by Nazerke

Закрытая онлайн-академия для подтверждённых клиентов JUICY, купивших Kenwood. Внутри нет магазина, оплат, подписок и CRM.

- Текущее демо: https://nazerke-academy-demo.vercel.app/
- Owner-approved scope: https://github.com/kires0214/Nazerke-academy/issues/1
- Полное ТЗ: docs/TECH_SPEC.md
- Модель контента и навигация: docs/CONTENT_MAP.md
- Модель БД: docs/DATA_MODEL.md
- Безопасность: docs/SECURITY.md
- DEV → PROD: docs/RELEASE.md
- Приёмка: docs/QA.md
- План работы: docs/PLAN.md
- Старт Codex: docs/CODEX_PROMPT.md

## Архитектура

Один Next.js проект (на этапе Codex migration), работающий на Vercel в двух окружениях DEV и PROD. PostgreSQL через Neon; приватное видео через Cloudflare Stream; Telegram login/бот/поддержка — через Vercel Functions. Исходники в GitHub. Отдельного TEST-окружения, Railway, VPS и лишних микросервисов не требуется.

## Текущий код

legacy-demo содержит неизменённый архив JUICY v3.2. Приложение в src/ использует Next.js App Router, PostgreSQL и серверную проверку доступа. Состояние аккаунтов, контента, прогресса и поддержки хранится в БД; переключателя ролей и localStorage-авторизации нет.

После клонирования: `npm ci`, `npm run demo:assets`, `npm test`, `npm run typecheck`, `npm run build`. Сборка автоматически проверяет и копирует 25 исходных изображений в игнорируемый public/assets. `npm start` запускает собранное приложение. Без credentials публичный сайт работает, закрытые операции возвращают отказ или 503. Mock используется только в тестах.

### DEV

Используйте отдельный Neon DEV и Vercel Development / branch Preview как DEV. Не создавайте TEST. Скопируйте только имена ключей из .env.example в Vercel; значения держите в Vercel secrets / игнорируемом .env.local. CLI-скриптам передавайте их через окружение процесса, например `node --env-file=.env.local --import tsx scripts/migrate.ts`.

После привязки Vercel и проверки окружения: `npm run db:migrate`, `npm run db:seed` (строго APP_ENV=DEV), `npm run dev`. Seed содержит только синтетический текст и исходные публичные названия, не создаёт аккаунты, не загружает частные уроки и не создаёт событий.

Первый Tech Admin: сначала выполнить настоящий проверенный вход Telegram; временно задать BOOTSTRAP_TECHADMIN_TELEGRAM_ID через секрет окружения CLI, затем `npm run db:bootstrap-admin`. Скрипт работает только пока Tech Admin отсутствует, требует существующего аккаунта, отзывает сессии и пишет аудит. Удалить временный ключ и войти снова. Веб-эндпоинта bootstrap нет.

### Структура

- src/app/(public), academy, admin — три отдельных интерфейса.
- src/lib/security.ts — Telegram HMAC, сессии, браузер, RBAC; accounts.ts — подтверждение, роли, grants.
- src/lib/content.ts — CMS, иерархия и канонические связи; PostgreSQL content — типизированные узлы course/module/lesson/recipe и др., content_links — связи без копирования рецептов.
- src/lib/api.ts — валидированные API; providers.ts / support.ts — Stream, Telegram, outbox и поддержка.
- migrations/ — контрольные суммы миграций, ограничения, индексы, append-only аудит.
- tests/ — PostgreSQL-совместимый PGlite и mock внешних HTTP-провайдеров. Движок закрывается после каждого сценария; отдельного сервера нет.

Изображения/PDF CMS до 5 МБ хранятся в PostgreSQL и выдаются после проверки доступа. Видео загружается напрямую в Cloudflare Stream с requireSignedURLs; backend выдаёт viewer token на 120 секунд. Уже выданный bearer token действует до истечения TTL; прекращение сессии немедленно запрещает новые tokens. Поддержка сохраняется до отправки Telegram; outbox имеет повторные попытки и ручной повтор в Studio, доставка at-least-once.

### Границы проверки

Локальные проверки не подтверждают реальную настройку Telegram, Neon, Stream, independent-connection races, backup/restore или готовность обработки реальных персональных данных. PROD остаётся под release gates из docs/RELEASE.md. Детальные команды и ограничения фиксируются в docs/IMPLEMENTATION.md и docs/DEV_RECEIPT.md.

## Внимание: репозиторий PUBLIC

Нельзя коммитить секреты, данные клиентов, приватные уроки и неопубликованные материалы. Изображения сейчас публичны на Vercel, но в историю PUBLIC GitHub их не дублируем: asset-manifest и скрипт дают воспроизводимое скачивание с контрольными суммами. До добавления непубличного контента Owner должен сделать GitHub PRIVATE. Это не блокирует разработку публичного исходного кода.
