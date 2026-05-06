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
