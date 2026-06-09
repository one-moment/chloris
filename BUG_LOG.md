# BUG_LOG.md

## Open Risks

### Coupang cart quantity handling

- Status: open risk
- Context: Cart row detection and quantity correction can fail when the cart already contains products or re-renders.
- Rule: Do not change selectors without artifacts.
- Required artifacts:
  - failed order request data
  - selector logs
  - match counts
  - chosen element index
  - full screenshot
  - row screenshot
  - page HTML
  - row outerHTML
  - environment details

### Non-Coupang vendor automation

- Status: not implemented
- Context: Sungwon Adpia, Gmarket, and Hyundai Deco are currently vendor-task handoff states.
- Next: Build vendor-specific skeletons after Purchase Agent production test.

## Fixed Bugs

### Bulk purchase parser treated metadata as an unknown item

- Status: fixed, deployed, and verified
- Date: 2026-06-09
- Issue: In a production Purchase Agent test, a line like `[운영 테스트] 2026-06-09 Purchase Agent 복수주문` before the first vendor section was parsed as an `unknown` vendor item with quantity `2026`.
- Fix: Bulk parser now skips likely metadata/title lines before the first vendor section unless the line is an explicit item marker or URL-only line.
- Verification: Added `agent-gateway:test` coverage for metadata before vendor sections, deployed the fix, and re-ran a production Purchase Agent draft/approve test with `hasUnknown:false`.

### Post/Send delay

- Status: fixed
- Fix: Optimistic UI and create API simplification.
- Verification: local and production responsiveness improved.

### Korean duplicate input in chat

- Status: fixed
- Fix: IME composition handling.
- Verification: local chat input confirmed.

### Production slow response

- Status: fixed
- Fix: region alignment, logging, DB query/index improvements.
- Verification: production response improved and `icn1` confirmed.

### Purchase worker 401

- Status: fixed
- Fix: worker token/env handling clarified and production token configured.
- Verification: worker polling returned 200 in Vercel logs.

### Auth user list exposure

- Status: fixed
- Date: 2026-06-08
- Issue: `/api/auth/me` returned user list while unauthenticated.
- Fix: unauthenticated response returns `currentUser:null` and `users:[]`.
- Verification: production `/api/auth/me` returned `{"currentUser":null,"users":[]}`.

### Deployment log written to chat instead of Ideas

- Status: corrected
- Date: 2026-06-09
- Issue: deployment logs were initially added as chat messages.
- Fix: same three logs were written as Ideas posts in `#배포로그`.
- Verification: production DB confirmed the three Ideas posts.
