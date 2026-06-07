# Purchase Bot MVP

This branch adds a minimal purchase bot to the existing internal communication tool. It does not create a separate project.

## Scope

- Users request repeat purchases in a channel message, for example `@구매봇 A4용지 2박스 주문`.
- The server parses the command, matches a registered `PurchaseItem`, creates a `PurchaseRequest`, and posts a bot reply.
- An approver calls the approve API to queue a `PurchaseWorkerTask`.
- A local Playwright worker running on a trusted Mac claims queued tasks and opens the vendor site.
- The worker may open the product page and prepare a cart, but it must stop before final payment.

## Safety Rules

- Do not store shopping mall IDs, passwords, card numbers, or payment credentials in the app database.
- Do not bypass CAPTCHA, 2FA, phone verification, login gates, or payment verification.
- Do not auto-click final payment, final order, or payment completion buttons.
- Stop and return `needs_human` when login, identity verification, file upload, price mismatch, or payment information is required.
- Human approval is required before a worker task is queued.

## Environment

Set the same worker token in Vercel and in the local worker environment:

```bash
PURCHASE_BOT_WORKER_TOKEN="replace-with-long-random-token"
PURCHASE_BOT_SERVER_URL="https://your-vercel-app.vercel.app"
PURCHASE_BOT_BROWSER_HEADLESS="false"
PURCHASE_BOT_BROWSER_CHANNEL="chrome"
PURCHASE_BOT_POLL_INTERVAL_MS="5000"
PURCHASE_BOT_RUN_ONCE="false"
```

Optional local paths:

```bash
PURCHASE_BOT_USER_DATA_DIR="~/.purchase-bot/browser-profile"
PURCHASE_BOT_SCREENSHOT_DIR="~/.purchase-bot/screenshots"
```

## Database

Apply the migration before using the feature:

```bash
npx prisma migrate deploy --schema prisma/schema.postgres.prisma
```

The migration seeds two placeholder items:

- `a4-paper`: A4 paper, Coupang
- `boro-namecard`: Boro Gangnam name card, Swadpia

Replace each seeded `url` with the real repeat-purchase or product URL before staff testing.

## Commands

Install Playwright Chromium once on the worker machine:

```bash
npx playwright install chromium
```

Open a persistent browser profile and log in manually:

```bash
npm run purchase-worker:login:coupang
npm run purchase-worker:login:swadpia
```

Run the worker:

```bash
npm run purchase-worker
```

## APIs

List purchase items:

```http
GET /api/purchase-bot/items
```

List purchase requests:

```http
GET /api/purchase-bot/requests
```

Approve or reject:

```http
POST /api/purchase-bot/requests/:requestId/approve
POST /api/purchase-bot/requests/:requestId/reject
```

Worker APIs require `Authorization: Bearer <PURCHASE_BOT_WORKER_TOKEN>`:

```http
GET /api/purchase-bot/worker/tasks
POST /api/purchase-bot/worker/tasks/:taskId/result
```

## MVP Test Flow

1. Apply the migration and update real `PurchaseItem.url` values.
2. Run the app and send `@구매봇 A4용지 2박스 주문` in a channel.
3. Confirm the bot posts a request summary with approve/reject API paths.
4. Approve the request from an admin session.
5. Run `npm run purchase-worker`.
6. Confirm the worker posts a result message with a screenshot path and stops before payment.

## Current Limitations

- Approve/reject is API-first. A later UI pass should add buttons in the bot message.
- Coupang automation only attempts safe cart preparation. Selector tuning is expected after real product URLs are added.
- Swadpia often requires design file or option checks, so the MVP opens the page and asks for human continuation.
- Screenshots are stored on the local worker machine. Uploading them to object storage can be added later.
