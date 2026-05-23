# MURU Mini App

Telegram Mini App for MURU Home Design with a React + TypeScript frontend and an Express + TypeScript backend.

## Project Structure

```text
frontend/   React + Vite + Telegram Mini Apps SDK
backend/    Express API
shared/     Shared modules (reserved)
```

## Prerequisites

- Node.js 20+
- npm 10+

## Environment

Copy `.env.example` to `.env` and fill values:

- `VITE_ADMIN_IDS` - comma-separated Telegram user IDs with admin access in frontend profile.
- `VITE_API_BASE_URL` - backend URL for admin sync requests.
- `PORT` - backend port.
- `ADMIN_TELEGRAM_IDS` - comma-separated Telegram user IDs allowed to run `/api/admin/sync`.
- `DATABASE_URL` - PostgreSQL connection string.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` - service account credentials.
- `CATALOG_SOURCE` - `xlsx` (default): read client **.xlsx** from Drive; `sheets`: legacy Google Sheets API.
- `GOOGLE_CATALOG_FILE_ID` - Drive file ID of the product registry xlsx ([MURU реестр заполнения товаров](https://docs.google.com/spreadsheets/d/13R05JyBIJsMl0fE7qQRxG1nVcKTU3XFg/edit) → `13R05JyBIJsMl0fE7qQRxG1nVcKTU3XFg`).
- `GOOGLE_CATALOG_XLSX_SHEET_NAME` - optional worksheet name inside the xlsx; if empty, the first sheet with an «артикул» header row is used.
- `ENABLE_SHEETS_STOCK_WRITE` - `false` for `CATALOG_SOURCE=xlsx` (no stock write-back to spreadsheet on orders; stock updates on full catalog sync only). Set `true` with `CATALOG_SOURCE=sheets` to restore Sheets stock deduction.
- `GOOGLE_SHEET_ID` - used only when `CATALOG_SOURCE=sheets`.
- `GOOGLE_DRIVE_FOLDER_ID` - root Drive folder for product photos ([пример](https://drive.google.com/drive/u/0/folders/1okABaQzSC-f9H6epKfhMH8sIImE2gLcQ)): раздел → … → товар → **Обрезанные** → **Главное фото** (`MUxxxx_1_O.*`) и **Доп фото** (`MUxxxx_2_O.*`, `MUxxxx_3_O.*`). В корне дерева — `muru_placeholder_600.webp`. В каталог попадают слоты **1** и **2**; legacy `MUxxxx-1.webp` в любой папке тоже поддерживается.

## Google Access Setup

1. Create a Google Cloud service account and enable **Google Drive API** (and **Google Sheets API** only if `CATALOG_SOURCE=sheets`).
2. Share the client **registry .xlsx** on Drive and the **root photo folder** with `GOOGLE_SERVICE_ACCOUNT_EMAIL` (**Reader** on xlsx is enough; **Editor** on the photo folder for public image links).
3. Put credentials into `.env` (`CATALOG_SOURCE=xlsx`, `GOOGLE_CATALOG_FILE_ID=…`, `ENABLE_SHEETS_STOCK_WRITE=false`).
4. After changing catalog file or env, run `pm2 reload ecosystem.config.js --update-env` on the server and run a full catalog sync in admin.

## Database Schema

Run SQL schema before first sync:

```bash
psql "$DATABASE_URL" -f backend/src/db/schema.sql
```

Повторный запуск этого файла безопасно добавит недостающие объекты (в т.ч. колонки обложек категорий `cover_drive_filename` / `cover_image_url`, если их ещё нет).

Если после деплоя в админке ошибка `column "cover_drive_filename" does not exist`, примените только миграцию колонок к **той же** базе, что в `DATABASE_URL` у backend:

```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/001_category_cover_columns.sql
```

Проверка: `psql "$DATABASE_URL" -c "\d categories"` — в списке колонок должны быть `cover_drive_filename` и `cover_image_url`.

## Run Frontend

```bash
cd frontend
npm install
npm run dev
```

## Run Backend

```bash
cd backend
npm install
npm run dev
```

## Build

```bash
cd frontend && npm run build
cd backend && npm run build
```

## Деплой на Beget VPS

### Подготовка
1. VPS: Ubuntu 22.04, 2 vCPU, 2GB RAM
2. Домен: настрой A-запись на IP сервера
3. Nginx + Let's Encrypt SSL

### Деплой backend
```bash
git clone https://github.com/your/repo.git /var/www/muru
cd /var/www/muru
cp .env.example .env
# Заполни .env реальными значениями
cd backend && npm ci && NODE_OPTIONS=--max-old-space-size=2048 npm run build && npm ci --omit=dev && cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Деплой frontend
```bash
cd frontend && npm install && npm run build
# dist/ загружать на Vercel или отдавать через nginx
```

### Обновление
```bash
git pull origin main
bash deploy.sh
```

## Работа с Telegram-ботом и Mini App на VPS

Ниже практический runbook для сервера (пример текущего пути: `/var/www/muru`).

### 1) Подготовка `.env` на VPS

В файле `.env` на сервере обязательно проверь:

- `TELEGRAM_BOT_TOKEN` - токен бота из BotFather.
- `TELEGRAM_MINI_APP_URL` - публичный HTTPS URL Mini App (например, `https://murushop.online`).
- `VITE_API_BASE_URL` - публичный backend URL (если frontend ходит не на same-origin).
- `VITE_ADMIN_IDS`, `ADMIN_TELEGRAM_IDS` - Telegram ID админов.
- `ORDER_NOTIFY_TELEGRAM_IDS` - Telegram ID для уведомлений по заказам.
- `DATABASE_URL`, `JWT_SECRET`, Google (`GOOGLE_*`) - обязательные backend-переменные.

Если переменные менялись, перезапускать backend нужно с `--update-env`.

### 2) Настройка бота в BotFather

1. Открой `@BotFather`.
2. Командой `/mybots` выбери нужного бота.
3. `Bot Settings` -> `Menu Button` -> задай URL Mini App (`https://...`).
4. Проверь, что URL публичный и с валидным SSL (Telegram требует HTTPS).

### 3) Деплой на VPS (backend + frontend)

```bash
cd /var/www/muru
git pull

# Backend: полный install -> build -> production deps
cd backend
npm ci
NODE_OPTIONS=--max-old-space-size=2048 npm run build
npm ci --omit=dev

# Frontend
cd ../frontend
npm install
npm run build

# PM2 запускать из корня проекта (где ecosystem.config.js)
cd ..
pm2 start ecosystem.config.js --update-env || pm2 reload ecosystem.config.js --update-env
pm2 save
```

Примечание: для `frontend` используется `npm install`, так как в проекте может отсутствовать `frontend/package-lock.json`.  
`npm ci` без lock-файла завершится ошибкой `EUSAGE`.

### 4) Проверка после деплоя

```bash
pm2 status
pm2 logs --lines 100
curl -sS http://127.0.0.1:4000/api/health
```

Проверить вручную:

- `https://murushop.online` открывается.
- Mini App открывается из Telegram через кнопку бота.
- Вкладка `Профиль` -> `Админ` видна только для ID из `VITE_ADMIN_IDS`.
- Создание заказа отправляет уведомления на `ORDER_NOTIFY_TELEGRAM_IDS`.

### 5) Image proxy (`/img/`)

Каталог отдаёт картинки через backend (sharp + дисковый кэш), не напрямую с Google Drive.

```bash
mkdir -p /var/www/muru/cache/img
# пользователь, под которым крутится pm2 (часто root на VPS):
chown -R "$(whoami)" /var/www/muru/cache
```

В `.env`: `IMAGE_CACHE_DIR=/var/www/muru/cache/img` (см. `.env.example`).

Nginx: см. [`deploy/nginx-img-cache.snippet`](deploy/nginx-img-cache.snippet) — `proxy_cache_path` в `http {}` и `location /img/` рядом с `/api/`.

После синка каталога кэш для затронутых Drive file id сбрасывается автоматически. Ручной сброс: `POST /api/admin/images/invalidate` body `{ "fileIds": ["..."] }`.

### 6) Частые проблемы на VPS

- `sh: 1: tsc: not found` - выполнен `npm ci --omit=dev` до сборки.  
  Решение: `npm ci` -> `npm run build` -> `npm ci --omit=dev`.
- `npm ci` в `frontend` падает с `EUSAGE`.  
  Решение: использовать `npm install` или добавить `frontend/package-lock.json` в репозиторий.
- `FATAL ERROR: ... heap out of memory` на backend build.  
  Решение: `NODE_OPTIONS=--max-old-space-size=2048 npm run build` (или 3072).
- `[PM2][ERROR] File ecosystem.config.js not found`.  
  Решение: запускать `pm2 ... ecosystem.config.js` из `/var/www/muru`.
- `curl 127.0.0.1:4000` не отвечает.  
  Решение: проверить `pm2 status`, `pm2 logs`, корректность `.env`.
- В админке «Сервер временно недоступен» при синхронизации, а `curl` на `127.0.0.1:4000` успешен.  
  Решение: увеличить таймаут nginx для API (полный синк может занимать 1–3 мин):

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:4000;
  proxy_read_timeout 300s;
  proxy_connect_timeout 60s;
}
```

Проверка синка напрямую (минуя nginx):

```bash
curl --max-time 600 -X POST http://127.0.0.1:4000/api/admin/sync \
  -H "x-telegram-user-id: YOUR_ADMIN_ID" \
  -H "Content-Type: application/json" \
  -d '{"telegramUserId": YOUR_ADMIN_ID}'
```

В `pm2 logs` после успешного синка ожидайте `withMain` > 0 и отсутствие предупреждения про `muru_placeholder_600.webp` (если файл в корне Drive).
- Нет уведомлений в Telegram.  
  Решение: проверить `TELEGRAM_BOT_TOKEN` и `ORDER_NOTIFY_TELEGRAM_IDS`.

## Admin Sync Endpoint

- `POST /api/admin/sync` — запускает синк в фоне, ответ **202** `{ accepted: true }` (не ждёт 3–5 мин).
- `GET /api/admin/sync/status` — статус job каталога: `idle` | `running` | `success` | `error` и `result` после успеха.
- `POST /api/admin/sync/category-covers` — фоновая синхронизация обложек разделов, ответ **202**; `GET /api/admin/sync/category-covers/status` — прогресс (`progress.message`) и итог.
- Auth: header `x-telegram-user-id` (или body `telegramUserId`) в `ADMIN_TELEGRAM_IDS`.
- Sync behavior:
  - reads products from Google Sheets,
  - recursively scans Drive tree (`MUxxxx_1_O` / `_2_O` / `_3_O` in **Главное фото** / **Доп фото**, legacy `MUxxxx-N.webp`),
  - сохраняет до **3** URL в `image_urls` (карусель: главное + 2 доп.),
  - publishes matched files and upserts products/categories/variants into PostgreSQL.

## Как запустить админку

1. В `.env` укажи админские Telegram ID:
   - `VITE_ADMIN_IDS` для фронтенда,
   - `ADMIN_TELEGRAM_IDS` для бэкенда.
2. Запусти backend:
   - `cd backend`
   - `npm install`
   - `npm run dev`
3. Запусти frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4. Открой Mini App, перейди в вкладку `Профиль` и нажми `Админ`.
5. На странице `AdminDashboard` используй кнопки:
   - `Синхронизировать каталог` для запуска `POST /api/admin/sync`,
   - `Обновить` для повторного запуска синхронизации и обновления статуса/лога.

## Как работает оформление заказа

- Корзина находится во вкладке `Корзина` в Mini App.
- Данные корзины и формы checkout сохраняются как серверный черновик через:
  - `GET /api/orders/draft/:telegramUserId`
  - `POST /api/orders/draft/save`
- Подтверждение заказа выполняется через:
  - `POST /api/orders/create`
- Заказ сохраняется в PostgreSQL со статусом `Черновик`.
- После создания:
  - клиент получает номер заказа и сообщение `Заказ принят. Ожидайте звонка менеджера`;
  - backend отправляет уведомления Telegram-админам через Telegram Bot API;
  - email-уведомление на `Muru_online@mail.ru` пока работает в режиме `console.log` заглушки.

### Запуск checkout flow локально

1. Применить схему БД (включая `orders` и `order_items`):
   - `psql "$DATABASE_URL" -f backend/src/db/schema.sql`
2. Поднять backend:
   - `cd backend`
   - `npm install`
   - `npm run dev`
3. Поднять frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4. Открыть Mini App:
   - добавить товары в корзину,
   - перейти к `Оформить заказ`,
   - выбрать `Доставка` или `Самовывоз`,
   - нажать `Подтвердить заказ`.

## Что уже работает

- Каталог: дерево категорий, листинг товаров, поиск/фильтрация, карточка товара и детальная страница.
- Корзина и checkout: добавление товаров, изменение количества, удаление, промокод (mock), выбор доставки/самовывоза, CDEK mock-варианты.
- Заказы: создание заказа в PostgreSQL со статусом `Черновик`, сохранение `order_items`, просмотр истории заказов в профиле.
- Профиль: редактирование ФИО/телефона/адреса, блок с персональными данными, базовые меню-элементы аккаунта.
- Избранное: добавление/удаление из детальной страницы, хранение в БД, пустое состояние с CTA.
- Под заказ: для `inStock = 0` показывается статус `Под заказ` и CTA `Сообщить о поступлении`.
- Уведомления о поступлении: `POST /api/catalog/restock-notify` и отправка админам через Telegram Bot API.
- Админка и синхронизация: `AdminDashboard`, запуск `POST /api/admin/sync`, статус/лог/метрики синка, проверка доступа по Telegram ID.
- UX-полиш: унифицированные empty states, loading skeletons, Telegram BackButton на внутренних экранах.
- MVP готов к ручному тестированию end-to-end сценариев.

## Чек-лист тестирования MVP

- [ ] Запуск фронта + бэка
- [ ] Синхронизация в админке (проверить фото по MUxxxx-1/2)
- [ ] Каталог → карточка → детальная страница
- [ ] Добавление в корзину + изменение количества
- [ ] Оформление заказа (адрес, CDEK, промокод)
- [ ] Создание заказа + уведомление в консоль
- [ ] «Под заказ» + кнопка «Сообщить о поступлении»
- [ ] Профиль + Избранное (пустое состояние)
- [ ] Админ-доступ по Telegram ID
