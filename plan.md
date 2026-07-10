# Core Tasks Verification Plan

## Rules

- Do not change application code unless a task is proven incomplete by tests.
- Prefer adding or updating tests over changing behavior.
- Follow the repo's existing coding style, file organization, test structure, mocking patterns, naming conventions, and formatting; do not introduce a new style unless the existing patterns cannot cover the task.
- If a flow already works, leave it unchanged and mark it covered by tests.
- Do not change database schema, public API shapes, routes, UI copy, styling, or role names unless a failing test proves a defect.
- Any code change must be minimal and performance-positive or correctness-critical.
- Optimize for speed by keeping tests mocked or in-memory where possible.
- Avoid live Supabase calls in automated tests.
- Completion notification is the test suite: each task area must have named tests that pass and clearly map to tasks 1-6.

## Summary

This plan verifies the six core WMS task areas from `tasks.md` with automated tests first. The goal is to confirm existing behavior, add missing test coverage, and avoid application code changes unless tests prove a real defect.

## Task Coverage Plan

1. Login and role routing
   - Add tests for BU Manager, Unit Staff, and Warehouse Manager login routing.
   - Add tests for logout/session clearing behavior where practical.
   - Add tests for missing or expired token redirect behavior through the existing auth guard/API 401 handling.

2. Transfer request lifecycle
   - Cover multi-line transfer creation.
   - Cover required fields, quantity validation, and `TRF-YYYY-NNNNN` reference generation.
   - Cover edit/cancel behavior before issuance.
   - Cover request detail visibility and status transition expectations.

3. Warehouse issuance
   - Cover warehouse queue eligibility for pending/approved requests.
   - Cover full issuance and status change to `ISSUED`.
   - Cover partial issuance with shortfall reason.
   - Cover stock decrement and insufficient-stock rejection through the issuance RPC wrapper/API behavior.

4. Unit GRN submission
   - Cover GRN submission for issued transfers.
   - Cover exact receipt transition to `COMPLETED`.
   - Cover variance transition to `COMPLETED_WITH_VARIANCE` with variance notes/reason capture.
   - Cover immutability expectations after GRN submission.

5. Return request flow
   - Cover linked and unlinked return creation.
   - Cover BU Manager approve/reject actions.
   - Cover Warehouse receipt behavior.
   - Cover final stock restoration/status behavior through the current Finance-gated return flow.

6. Notifications
   - Cover in-app notifications for transfer submitted, issuance, GRN variance, and return actions.
   - Cover unread/read behavior.
   - Cover role-appropriate visibility for operational notifications.

## Test Strategy

- Use Vitest with existing mocked Supabase patterns.
- Prefer service and API route tests over browser E2E tests for speed.
- Add tests with clear names such as `core-task-01-auth-routing`, `core-task-02-transfer-lifecycle`, through `core-task-06-notifications`.
- Reuse existing tests where they already prove the task behavior, and add only the missing coverage.

## Validation Commands

Run dependencies first if `node_modules` is missing:

```bash
npm install
```

Then verify:

```bash
npm test
npm run lint
npm run build
```

## Completion Criteria

- Each task area 1-6 has explicit automated test coverage.
- Existing tests continue passing.
- New tests fail clearly if a core flow regresses.
- No application code is changed unless a failing test proves the task is not already implemented.
- Any code change made later must be covered by the relevant task test.
