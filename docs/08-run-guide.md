# Руководство по запуску

Все команды ниже реально выполнялись при разработке и проверены — не переписаны из общих шаблонов.

## Требования

- **Node.js** 20+ (разработка и проверка велись на v26)
- **PostgreSQL** 16 (или совместимая; на macOS ставится через Homebrew)
- npm (идёт вместе с Node.js)

## 1. PostgreSQL

### macOS (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16
```

Создать роль и базу данных (имя роли и пароль должны совпадать с тем, что указано в `backend/.env`):

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createdb fsin_crm
psql -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';" postgres
```

(Если роль `postgres` уже существует в вашей установке PostgreSQL — этот шаг не нужен, используйте свои учётные данные и поправьте `DATABASE_URL` в `.env`.)

### Другие ОС

Установите PostgreSQL 16 любым удобным способом (официальный установщик для Windows, `apt`/`dnf` для Linux) и создайте базу данных `fsin_crm` с пользователем, указанным в `.env`.

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Откройте `.env` и при необходимости поправьте `DATABASE_URL` под вашу установку PostgreSQL. Сгенерируйте свой `JWT_SECRET` (не используйте значение из примера в продакшене):

```bash
openssl rand -hex 32
```

Установка зависимостей и миграции:

```bash
npm install
npm run db:migrate     # прогоняет prisma migrate dev, создаёт таблицы
npm run db:seed        # наполняет демо-данными (см. ниже)
```

Запуск сервера в режиме разработки:

```bash
npm run start:dev
```

Backend поднимется на `http://localhost:3000/api`. В консоли будет видно строку `🚀 Backend running on http://localhost:3000/api`.

### Демо-аккаунты после seed

| Email | Пароль | Роль |
|---|---|---|
| `admin@vifsin.ru` | `Admin123!` | Администратор |
| `manager@vifsin.ru` | `Admin123!` | Руководитель |
| `foreman1@vifsin.ru` | `Admin123!` | Старшина (группа 201) |
| `foreman2@vifsin.ru` | `Admin123!` | Старшина (группа 202) |

Seed также создаёт: 3 направления, 4 образовательные программы, 8 групп, 120+ студентов, историю посещаемости за прошлые дни, справочники причин/периодов/статусов.

### Проверка, что backend работает

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vifsin.ru","password":"Admin123!"}'
```

Должен вернуться JSON с `accessToken`.

## 3. Frontend

В новом терминале:

```bash
cd frontend
npm install
npm start
```

Frontend поднимется на `http://localhost:4200` и будет обращаться к backend по адресу из `frontend/src/environments/environment.ts` (по умолчанию — `http://localhost:3000/api`).

Откройте `http://localhost:4200` в браузере и войдите одним из демо-аккаунтов.

## 4. Запуск обоих сразу

В корне репозитория есть вспомогательный `package.json` с командой:

```bash
npm run install:all   # ставит зависимости в backend и frontend
npm run dev           # запускает оба процесса параллельно (concurrently)
```

Корневой `package.json` содержит только команды запуска — весь код приложения лежит в `backend/` и `frontend/`.

## 5. Тесты

```bash
cd backend
npm test              # unit-тесты (моки, без БД)
npm run test:e2e      # e2e-тесты — используют ОТДЕЛЬНУЮ базу fsin_crm_test,
                       # автоматически пересоздают и засеивают её перед запуском
```

E2E-тесты не трогают базу `fsin_crm`, которую использует запущенный через `start:dev` backend — их можно гонять, не мешая ручной проверке в браузере.

## 6. Полезные команды Prisma

```bash
npm run db:studio     # визуальный браузер БД (Prisma Studio) на localhost:5555
npm run db:reset       # полный сброс базы + повторный seed (ОСТОРОЖНО: удаляет данные)
```

## Частые проблемы

**`Property 'X' does not exist on type 'PrismaService'`** — не выполнен `npx prisma generate` (обычно запускается автоматически после `db:migrate`/`npm install`, но если он прерван — выполните вручную).

**`ECONNREFUSED` при обращении к БД** — PostgreSQL не запущен: `brew services start postgresql@16` (macOS) или аналог для вашей ОС.

**`P1001: Can't reach database server`** — проверьте `DATABASE_URL` в `.env`: имя пользователя, пароль, порт (`5432` по умолчанию), имя базы.

**Frontend не видит backend / ошибки CORS** — убедитесь, что `CLIENT_ORIGIN` в `backend/.env` совпадает с адресом, на котором реально открыт frontend (по умолчанию `http://localhost:4200`).
