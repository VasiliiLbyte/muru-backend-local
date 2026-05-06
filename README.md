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
- `GOOGLE_SHEET_ID` - Google Sheet ID (`13R05JyBIJsMl0fE7qQRxG1nVcKTU3XFg` by default).
- `GOOGLE_DRIVE_FOLDER_ID` - folder ID for `MURU_Images`.

## Google Access Setup

1. Create a Google Cloud service account and enable **Google Sheets API** and **Google Drive API**.
2. Share the target Google Sheet and Drive folder with `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
3. Put credentials into `.env`.

## Database Schema

Run SQL schema before first sync:

```bash
psql "$DATABASE_URL" -f backend/src/db/schema.sql
```

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

## Admin Sync Endpoint

- Endpoint: `POST /api/admin/sync`
- Auth input: header `x-telegram-user-id` (or body `telegramUserId`) must be present in `ADMIN_TELEGRAM_IDS`.
- Sync behavior:
  - reads products from Google Sheets,
  - scans Drive files by `MUxxxx-1.webp` and `MUxxxx-2.webp`,
  - generates public image links,
  - upserts products/categories/variants into PostgreSQL.

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

- Каталог, карточка товара, детали товара, корзина, checkout и создание черновика заказа в PostgreSQL.
- Для товаров с `inStock = 0` показывается режим `Под заказ` и кнопка `Сообщить о поступлении`.
- Кнопка `Сообщить о поступлении` отправляет уведомление админам через Telegram Bot API (`POST /api/catalog/restock-notify`).
- Унифицированы пустые состояния для корзины, избранного и блока заказов в профиле.
- Добавлены loading skeleton состояния для каталога, избранного, профиля и admin sync.
- Telegram BackButton централизованно показывается только на внутренних экранах (деталка, checkout, админка).
- MVP готов к полноценному ручному тестированию основных пользовательских flow.
