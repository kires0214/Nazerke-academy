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

legacy-demo содержит архив действующего статического сайта JUICY v3.2. Это визуальный и функциональный референс, **а не production backend**. Реальная авторизация и CMS будут реализованы Codex.

После клонирования: npm install; npm run demo:assets (загрузка и проверка публично доступных изображений); npm run demo:check; npm run demo:dev (локальный сервер localhost:3000). Для статического baseline зависимости не требуются.

## Внимание: репозиторий PUBLIC

Нельзя коммитить секреты, данные клиентов, приватные уроки и неопубликованные материалы. Изображения сейчас публичны на Vercel, но в историю PUBLIC GitHub их не дублируем: asset-manifest и скрипт дают воспроизводимое скачивание с контрольными суммами. До добавления непубличного контента Owner должен сделать GitHub PRIVATE. Это не блокирует разработку публичного исходного кода.
