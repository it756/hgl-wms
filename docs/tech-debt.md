# Known Tech Debt

Flagged during the 2026-07-06 architecture scan (see [architecture.md](./architecture.md), [project-context.md](../project-context.md)). None of these are bugs today — they're inconsistencies worth resolving deliberately before they compound.

## 1. `lib/rbac.ts` is dead code

Every `app/api/*/route.ts` handler reimplements role checks inline (`user.user_metadata.role` string comparisons) instead of calling `hasRole`/`hasAnyRole`/`isAdmin`/etc. from `lib/rbac.ts`. The helpers are only exercised by their own unit test.

**Risk:** role-check logic can drift between routes since there's no single source of truth. **Fix direction:** migrate routes to use `lib/rbac.ts` incrementally, or delete it if the inline pattern is the intended standard going forward.

## 2. Two overlapping variance-reconciliation mechanisms

`variance_proposals` (Finance-reviewed, current) and the older `variance_dispositions`/`stock_losses` pair both exist and do similar jobs.

**Risk:** unclear which one a new feature request should extend; potential for double-handling the same variance. **Fix direction:** confirm with product whether the older pair is fully superseded and can be deprecated, or document when each applies.

## 3. No shared frontend API client

Every `"use client"` page manually reads `localStorage.getItem("access_token")` and attaches `Authorization: Bearer` per fetch call — the same ~5 lines repeated across ~36 files.

**Risk:** any change to token handling (refresh, storage mechanism, header format) requires touching all 36 call sites. **Fix direction:** extract a small `lib/api/client.ts` wrapper; migrate pages incrementally, no need for a big-bang rewrite.

## 4. `notificationWorker.ts` has no trigger

`lib/workers/notificationWorker.ts` is designed to be invoked by a cron route or external scheduler (per its own header comment), but no such route or schedule exists anywhere in the repo.

**Risk:** any feature that assumes queued/unread notifications get emailed on a schedule is silently relying on something that doesn't run. **Fix direction:** either wire a cron trigger (e.g. a `/api/cron/notifications` route + external scheduler, or a Supabase scheduled function) or confirm this worker is intentionally unused and remove it.
