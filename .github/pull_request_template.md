## Summary

Describe what changed and why.

## Target Branch

- [ ] `dev` from feature/source branch
- [ ] `QA` from `dev`
- [ ] `staging` from `QA`
- [ ] `main` from `staging`

## Spec / Task Reference

Link the relevant issue, PRD, `spec.md`, `plan.md`, `tasks.md`, or acceptance criteria.

## Correctness

- [ ] Logic and state transitions were checked.
- [ ] Null, empty, and edge cases were considered.
- [ ] Tests were added or updated for changed acceptance criteria.
- [ ] Existing behavior outside the PR scope was preserved.

## Security And Data Scope

- [ ] Auth/RBAC behavior was checked.
- [ ] SBU/unit/tenant scoping was checked.
- [ ] Inputs at API, import, export, or form boundaries are validated.
- [ ] No secrets or unsafe public environment variables were introduced.

## Risk Areas

- [ ] API or service boundary change
- [ ] Database migration, RLS, permission, or stock mutation change
- [ ] Dependency or lockfile change
- [ ] Notification, audit, approval, or finance flow change
- [ ] None of the above

## Tests Run

Paste the commands run, or explain why a check was not run.

```bash

```

## Screenshots / Notes

Add screenshots for UI changes and any rollout, rollback, or manual verification notes.
