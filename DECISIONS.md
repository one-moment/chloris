# DECISIONS.md

## 2026-06-15: CRM module data model (Ralph loop, iteration 1)

- `Customer` and `Reservation` modeled per `docs/templates-and-crm.md`. Loosely coupled like
  `PostTemplate`: scalar id fields, **no Prisma `@relation` / no FK constraints**, indexes only.
  Rationale: keeps the table deploy-safe before the migration is applied (app degrades when
  tables are absent) and avoids editing existing models (Branch/Channel) with back-relations.
- `Customer.phone` is `@unique` (chain-wide identity key) so the reservation form can
  `upsert` by phone (spec requires upsert-by-phone). One Customer per phone across all branches.
- `Reservation.amount` is `Int` (KRW, no decimals). `status` defaults to `예약접수`.
  `reservedAt` defaults to now(); `pickupAt` required. Spec-optional fields (`channelId`,
  `postId`, `note`, `homeBranchId`, `memo`, `createdById`) are nullable.
- Migration `20260615103000_add_crm_module` hand-written (additive CREATE TABLE, no FK),
  **NOT applied to any production DB** — `.env DATABASE_URL` points at Boro prod, so no
  `prisma migrate`/`db push` was run; apply is deferred to explicit user approval (AGENTS.md).

## 2026-06-11 (night): Multi-company split & Borough theme

- The product serves three companies as internal tools: 원모먼트(online flower delivery), 보로플라워마켓(offline franchise flower shop), 오늘꽃(online flower wholesale + large-venue supply). Shared base = chat + board (게시판); each company gets custom modules per its work.
- Tool category name: PENDING user decision. Proposal recorded in TODO (platform codename Chloris as the engine; per-company branded instances, e.g. "Borough Workspace"). Category descriptor candidates: 사내 업무 OS / 워크스페이스 / 협업·자동화 플랫폼.
- Separation approach (recommended): ONE shared core codebase; per-company differs by (a) brand theme (CSS token set) and (b) enabled modules. This avoids triple-maintaining the chat/board base. Concrete forking/repo strategy still to be decided (multi-tenant single deploy vs. per-company deploy from shared core vs. forks).
- Design: applied the Borough Flower Market design system to the current tool (= the 보로플라워마켓 instance; its branches 강남1/강남2/잠실 match the design system's store list). Implemented as token remap in `styles.css` (forest green #185640 + sage gold #D5CD8C + warm paper #F7F4EA + serif fonts) + brand chrome in `app/globals.css` (green sidebar, serif titles, gold focus, card accent strip) + logo assets in `public/brand/`. Tokens kept under existing semantic variable names so the whole app re-skins and so other companies' themes can swap the same names later.

## 2026-06-11 (evening): Templates, CRM & Reservations

- Brand is 보로플라워 (multi-branch flower shop). Branches confirmed: 강남1호점, 강남2호점, 잠실점 (already seeded; no rename). Future branches added as Branch records (e.g. 성수역점) with no screen/code change.
- Customer is CHAIN-WIDE: one Customer per phone number across all branches. Cross-branch visits share order context so any branch can serve a 보로플라워 customer with full history (brand value). This overrides the earlier branch-scoped customer visibility idea.
- PII balance: customer + order history visible chain-wide to authenticated staff; phone masked in bulk lists/exports, full when actively serving; HQ unrestricted; never log/commit customer data.
- Templates ≠ forms (separate mechanisms, developed independently): TEMPLATES are free-text post helpers (구매요청·인계사항·공지) → output is a plain post, no structured capture, general/core. FORMS are typed-field data entry (예약/주문) → save a system record, module-owned, with validation/customer-lookup/status. Reservation input is a dedicated FORM (not a template) writing to the reservation system.
- Template system (feature 1): user/admin-authored reusable text templates (`PostTemplate`, scope personal|shared), insert-time tokens `{{지점}}/{{오늘}}/{{작성자}}`. Lives in CORE (composer), not a module. Ships independently of CRM.
- CRM + Reservations (feature 2): internal module `modules/crm`; `Customer` (phone key) + `Reservation` (= spreadsheet row); routes `/work/customers`, `/work/reservations` (list + pickup calendar + per-branch + HQ rollup). The existing Google Sheet is the model; columns map 1:1 (see doc). Order/reservation history is created from 주문서 post submissions (the template↔CRM loop) and feeds 지점 인사이트 metrics.
- External shopping-mall sync is optional/later via integration bot, not required.
- Build order: ① template system → ② CRM core → ③ connect (submit→record, composer lookup) → ④ metrics → ⑤ optional mall sync.
- Full spec: `docs/templates-and-crm.md`.

## 2026-06-01: MVP Deployment Stack

- Use Vercel for app hosting.
- Use Supabase PostgreSQL for production DB.
- Defer AWS-heavy infrastructure until the MVP proves usage.

## 2026-06-03: Responsiveness

- Use optimistic UI for message/post/comment creation.
- Avoid full refresh after create APIs.
- Prefer Vercel function region close to Supabase DB.

## 2026-06-07: Purchase Worker Safety

- Use handoff/worker flow instead of trying to fully automate checkout.
- Final payment is never automated.
- Browser automation failures must collect artifacts before selector changes.

## 2026-06-08: Bot Integration Model

- Bots must be installable per channel.
- Purchase Bot is no longer a global hardcoded bot.
- External bot support should be designed through webhooks/tokens, not direct DB access.

## 2026-06-08: Agent Layer

- Add Agent Gateway inside the Chloris server.
- Add Purchase Agent as the first role agent.
- Keep OpenAI intent classification out of v1 production flow.
- Use rule-based parsing for Purchase Agent v1.

## 2026-06-08: Bulk Purchase Flow

- Bulk purchase requests are first converted into editable drafts.
- Draft approval splits work into vendor tasks.
- Coupang URL lines can become `PurchaseRequest` and `PurchaseWorkerTask`.
- Non-Coupang vendors are marked as needing vendor bots or manual handoff.

## 2026-06-09: Deployment Log Location

- Deployment logs must be written as Ideas posts in the `#배포로그` channel.
- Do not treat deployment logs as chat-only messages.

## 2026-06-09: Handoff Documents

- Keep `AGENTS.md`, `HANDOFF.md`, `DECISIONS.md`, `TODO.md`, `ENV_CHECKLIST.md`, and `BUG_LOG.md` current.
- Update `HANDOFF.md` and `TODO.md` before ending every future work session.

## 2026-06-11: Phase 1 Start and Work Ordering

- Architecture Phase 1 starts now as the main thread; Coupang worker stabilization runs in parallel, driven by real failure artifacts as they occur (worker work is artifact-gated per AGENTS.md, so waiting on it blocks nothing).
- Branch default: schema supports multi-branch, but channel linkage (`Channel.branchId`) is nullable and unset initially. Work records will inherit branch from their channel once linked.
- 2026-06-11 user confirmed initial branches: 강남1호점, 강남2호점, 잠실점 (seeded in `20260611090000_add_branch_layer`). Future branches: create Branch record, then link channels to it.
- Module boundary enforcement is a lint-stage script (`scripts/check-module-boundaries.mjs`), verified to fail on cross-module imports.

## 2026-06-10: Platform Architecture v2

- Sidebar splits into communication / work / admin sections; work features get dedicated routes under `/work/*`, not channel tabs.
- Work features are vertical-slice modules under `modules/<slug>/`, registered through a code-level manifest registry.
- Modules may import core and platform only. Module-to-module imports are forbidden (ESLint-enforced); cross-module flows go through a platform event bus.
- Entities used by two or more modules move to core master data. `Branch` and `BranchAssignment` are added early (Phase 1).
- A global approval inbox at `/work/inbox` aggregates all `ApprovalRequest` records across modules.
- Field input happens in chat (agent mention + photo); managers process in dashboards/inbox. No per-module input forms.
- Branch insights module aggregates KPIs through a platform metrics registry; modules declare metrics in their manifests.
- Per-module "team lead" agents orchestrate unit-task bots; employee-built bots integrate only via app registry + scoped tokens/webhooks/local worker queues, never direct DB access.
- Status vocabulary and chip colors are defined once in core; modules may not invent their own.
- Module data must not be added to `/api/state`.
- Full design: `docs/platform-architecture.md` (v2). Open items in its section 16.

## 2026-06-09: Team-Built Agent/Bot Framework

- Chloris should support agents and bots created by team members, not only bots built directly inside the core app.
- Team-built integrations must be registered as apps before they can run in channels.
- Registration flow should be:
  - draft registration
  - admin review
  - capability declaration
  - channel installation
  - channel-specific configuration
  - event subscription
  - execution logging
  - disable/revoke path
- External integrations must not access the DB directly.
- External integrations must communicate through approved APIs, webhooks, or local worker task queues.
- Tokens/secrets must be hashed or stored outside source-controlled documents.
- Every agent/tool/bot invocation should leave an audit trail through `AgentRun`, `AgentToolCall`, or `BotEventLog`.
- The initial framework should be registry-first and permission-first; marketplace-style UI can come later.
- For Purchase Agent, vendor bots are tools under the Purchase Agent rather than global channel clutter.
