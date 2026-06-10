# TODO.md

## Next Session Priority

- [x] Create Claude handoff document with local paths, GitHub links, project structure, commands, safety rules, and current branch status.
- [ ] Push local commits if the next agent will continue from GitHub instead of this local folder.
- [x] Confirm team-built Agent/Bot framework plan before deeper implementation:
  - [x] app registry lifecycle: draft/review/active/disabled/revoked
  - [x] capability declaration for agents, tools, bots, events, and permissions
  - [x] external webhook/API-token skeleton with hashed secret storage
  - [x] local worker job adapter pattern
  - [x] audit logs for every agent/tool/bot execution
  - [x] admin UX that installs agents first, then shows child bots/tools under each agent
- [x] Production test in `#구매요청`:
  - [x] submit a real bulk purchase request to Purchase Agent
  - [x] confirm `PurchaseOrderDraft` is created
  - [x] edit draft line values
  - [x] approve draft
  - [x] confirm `PurchaseOrderVendorTask` records
  - [x] confirm Coupang URL lines create worker queue tasks
- [ ] Run local purchase worker against production task queue only after confirming worker token and target server.
- [ ] Collect artifacts for any Coupang cart issue before code edits.
- [x] Update `#배포로그` Ideas board after test results.
- [x] Commit today's framework docs, parser fix, and deployment log note if not already committed.

## Purchase Agent

- [x] Fix bulk parser so metadata/title lines before vendor sections are not parsed as unknown items.
- [ ] Add clearer UI for approved draft to vendor task transition.
- [ ] Add vendor task detail view.
- [ ] Add manual handoff state for non-Coupang vendors.
- [ ] Add admin controls for supported vendors per channel.
- [ ] Add structured validation for missing quantity, URL, option, and vendor.
- [ ] Keep vendor bots as Purchase Agent tools, not always-visible channel apps.

## Coupang Worker

- [ ] Stabilize cart row matching.
- [ ] Stabilize quantity correction.
- [ ] Handle existing cart items.
- [ ] Handle duplicate product URLs.
- [ ] Save row-level screenshot and HTML on every quantity failure.
- [ ] Do not continue after quantity mismatch.

## Vendor Bots

- [ ] Define vendor bot adapter interface:
  - [ ] vendor slug
  - [ ] supported automation levels
  - [ ] required credentials
  - [ ] supported input schema
  - [ ] output/result schema
  - [ ] handoff mode
- [ ] Sungwon Adpia bot skeleton.
- [ ] Gmarket handoff skeleton.
- [ ] Hyundai Deco handoff skeleton.
- [ ] Vendor-specific order form model if needed.

## Admin UX

- [ ] Improve Agent/Bot settings panel.
- [ ] Show channel-installed agents compactly.
- [ ] Show connected bots/tools under each agent.
- [ ] Show vendor task status summary.
- [ ] Add team-built app registry view later:
  - [ ] submitted apps
  - [ ] review status
  - [ ] declared permissions
  - [ ] install/disable/revoke controls

## Required Before Ending Any Future Session

- [x] Update `HANDOFF.md`.
- [x] Update `TODO.md`.
- [ ] Update `DECISIONS.md` if a decision changed.
- [ ] Update `BUG_LOG.md` if a bug was found or fixed.
- [x] Run relevant tests or explicitly record why tests were not run.
- [ ] Do not leave sensitive values in docs, logs, or committed files.
