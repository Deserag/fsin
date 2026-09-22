# ИС учёта контингента и посещаемости (УИС)

Информационная система учёта контингента обучающихся и контроля посещаемости образовательной организации уголовно-исполнительной системы. Дипломный прототип — см. `docs/09-vkr-materials.md` для точной нормативной классификации того, что в системе реализовано.

## Стек

- **Frontend:** Angular 19 (standalone components, signals), SCSS
- **Backend:** NestJS 12, Prisma 5 ORM
- **База данных:** PostgreSQL 16
- **Аутентификация:** JWT + Argon2

Подробное обоснование каждого выбора — `docs/02-architecture-and-stack.md`.

## Структура

```
fsin/
├── backend/    NestJS + Prisma API (порт 3000, префикс /api)
├── frontend/   Angular SPA (порт 4200)
├── docs/       документация и материалы ВКР
└── package.json  только команды запуска, без кода приложения
```

## Быстрый старт

Полная инструкция с диагностикой типовых проблем — `docs/08-run-guide.md`. Коротко:

```bash
# 1. PostgreSQL
brew install postgresql@16 && brew services start postgresql@16
createdb fsin_crm

# 2. Backend
cd backend
cp .env.example .env      # поправьте DATABASE_URL/JWT_SECRET при необходимости
npm install
npm run db:migrate
npm run db:seed
npm run start:dev          # http://localhost:3000/api

# 3. Frontend (в новом терминале)
cd frontend
npm install
npm start                  # http://localhost:4200
```

Или из корня репозитория: `npm run install:all && npm run dev` (запускает оба процесса параллельно).

## Демо-аккаунты (после `npm run db:seed`)

| Email | Пароль | Роль |
|---|---|---|
| `admin@vifsin.ru` | `Admin123!` | Администратор |
| `manager@vifsin.ru` | `Admin123!` | Руководитель |
| `foreman1@vifsin.ru` | `Admin123!` | Старшина |

## Тесты

```bash
cd backend
npm test          # unit
npm run test:e2e  # e2e — изолированная тестовая БД, автоматически пересоздаётся
```

## Документация

Полный комплект — в [`docs/`](docs/), начиная с [`docs/01-system-overview.md`](docs/01-system-overview.md).
