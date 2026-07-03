1.⁠ ⁠Login and role routing
•⁠  ⁠Sign in as BU Manager, Unit Staff, Warehouse Manager.
•⁠  ⁠Verify each role lands on the correct dashboard/queue.
•⁠  ⁠Verify logout and forced redirect on missing/expired token.

2.⁠ ⁠Transfer request lifecycle
•⁠  ⁠BU Manager creates transfer with multiple line items.
•⁠  ⁠Validate required fields, quantity rules, and reference generation.
•⁠  ⁠Edit/cancel behavior before issuance.
•⁠  ⁠View request details and status transitions.

3.⁠ ⁠Warehouse issuance
•⁠  ⁠Warehouse Manager sees pending/approved requests in queue.
•⁠  ⁠Issue full quantities and confirm status becomes issued.
•⁠  ⁠Issue partial quantities with shortfall reason.
•⁠  ⁠Validate stock decrement and insufficient-stock rejection path.

4.⁠ ⁠Unit GRN submission
•⁠  ⁠Unit Staff submits GRN for issued transfer.
•⁠  ⁠Exact receipt path: completed status.
•⁠  ⁠Variance path: completed with variance status and reason capture.
•⁠  ⁠Ensure transfer/GRN immutability after submission.

5.⁠ ⁠Return request flow
•⁠  ⁠Unit Staff raises return (linked and unlinked cases).
•⁠  ⁠BU Manager approves/rejects return.
•⁠  ⁠Warehouse receives return and confirms stock restoration behavior.
•⁠  ⁠Validate status transitions end-to-end.

6.⁠ ⁠Notifications (operational)
•⁠  ⁠Verify in-app notifications for transfer submitted, issuance, GRN variance, return actions.
•⁠  ⁠Confirm unread/read behavior and role-appropriate visibility.
