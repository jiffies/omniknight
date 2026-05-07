# Scheduler Start Time Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add optional per-group schedule start time and a global scheduler timezone so 24-hour groups can produce daily reports at a stable local time.

**Architecture:** Store `summaryStartTime` on each group and validate it through the shared schema. Move anchored schedule calculation into a small pure TypeScript helper so the scheduler can compare the latest due anchor with `lastSummaryAt`. Keep legacy rolling interval behavior when no start time is configured.

**Tech Stack:** TypeScript, Hono, Drizzle SQLite, React, Vite, pnpm/turbo.

---

## Chunk 1: Data And Configuration

### Task 1: Add Group Start Time Column

**Files:**
- Modify: `packages/db/src/schema/groups.ts`
- Create: `packages/db/drizzle/0007_summary_start_time.sql`

- [x] Add `summaryStartTime: text('summary_start_time')` beside the other summary settings.
- [x] Add SQL migration: `ALTER TABLE groups ADD summary_start_time text;`
- [x] Run `pnpm --filter @omniknight/db typecheck`.

### Task 2: Add Scheduler Timezone Env

**Files:**
- Modify: `apps/backend/src/config/env.ts`
- Modify: `apps/backend/.env.example`

- [x] Add `SCHEDULER_TIMEZONE` to env schema with default `Asia/Shanghai`.
- [x] Document the setting in `.env.example` as an IANA timezone.
- [x] Run `pnpm --filter @omniknight/backend typecheck`.

### Task 3: Extend Shared Validation

**Files:**
- Modify: `packages/shared/src/schemas/index.ts`

- [x] Add reusable `summaryStartTimeSchema`.
- [x] Add `summaryStartTime` to `updateGroupSchema` as optional nullable `HH:mm`.
- [x] Run `pnpm --filter @omniknight/shared typecheck`.

## Chunk 2: Scheduler Semantics

### Task 4: Add Timezone Schedule Helpers

**Files:**
- Create: `apps/backend/src/services/scheduler/timezone-schedule.ts`

- [x] Implement `validateTimeZone(timeZone: string): void`.
- [x] Implement `getMostRecentScheduleAnchor(now, startTime, intervalHours, timeZone): Date`.
- [x] Implement helpers using `Intl.DateTimeFormat` only; no new runtime dependency.
- [x] Cover examples manually with a small temporary command or exported helper call.

### Task 5: Use Anchored Scheduling

**Files:**
- Modify: `apps/backend/src/services/scheduler/scheduler.ts`

- [x] Import `env` and timezone schedule helpers.
- [x] Validate scheduler timezone at service construction or startup.
- [x] Keep legacy interval behavior when `group.summaryStartTime` is empty.
- [x] For configured start time, compute `dueAt`.
- [x] Trigger only when `lastSummaryAt` is missing or older than `dueAt`.
- [x] Use window `dueAt - interval ~ dueAt`.
- [x] Update `lastSummaryAt` to `dueAt` immediately after job creation.

### Task 6: Run New Group Once Immediately

**Files:**
- Modify: `apps/backend/src/routes/groups.ts`

- [x] Import `createSummaryJob` and `executeSummaryJob`.
- [x] After successful insert, create a `scheduled` job for `now - summaryInterval ~ now`.
- [x] Start execution asynchronously and log failures without failing the create request.

## Chunk 3: Frontend Configuration

### Task 7: Add Start Time To Group UI

**Files:**
- Modify: `apps/web/src/pages/Groups.tsx`

- [x] Add `summaryStartTime` to edit form state.
- [x] Include it when entering edit mode for groups and topics.
- [x] Add an `<input type="time">` in parent group configuration.
- [x] Add the same field in topic configuration.
- [x] Display `按间隔滚动` when unset, otherwise display `每天从 HH:mm 开始`.
- [x] Save an empty input as `null`.

## Chunk 4: Verification And Documentation

### Task 8: Verify The Full Workspace

**Files:**
- No code files.

- [x] Run `pnpm typecheck`.
  - Result: blocked by existing `@omniknight/web` type errors around Hono RPC route typing and push notification types; backend/db/shared typechecks pass.
- [x] Run `pnpm build`.
- [x] Run `git status --short`.

### Task 9: Commit Implementation

**Files:**
- All modified implementation files.

- [x] Review `git diff`.
- [x] Commit with `feat: add scheduler start time`.
