# Retry Failed Summary Jobs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let users retry a failed summary job from the task list using the same original job parameters.

**Architecture:** Add a backend retry endpoint under summary jobs that only accepts failed jobs, creates a new job with the original `groupId`, `periodStart`, `periodEnd`, and `taskType`, then executes it asynchronously. Add a small action button in the existing task table for failed rows and refresh the list after retry creation.

**Tech Stack:** TypeScript, Hono, Drizzle SQLite, React, Vite, pnpm/turbo.

---

## Chunk 1: Backend Retry Endpoint

### Task 1: Add POST /api/summaries/jobs/:id/retry

**Files:**
- Modify: `apps/backend/src/routes/summaries.ts`

- [x] Fetch the original job by id.
- [x] Return 404 when the job is missing.
- [x] Return 400 when the job status is not `failed`.
- [x] Create a new job with original `groupId`, `periodStart`, `periodEnd`, and `taskType`.
- [x] Execute the new job asynchronously.
- [x] Return `202` with `{ data: { jobId } }`.
- [x] Run `pnpm --filter @omniknight/backend typecheck`.

## Chunk 2: Frontend Retry Action

### Task 2: Add retry button to failed jobs

**Files:**
- Modify: `apps/web/src/pages/Tasks.tsx`

- [x] Add local retrying id state.
- [x] Add `handleRetryTask(taskId)` that calls the retry endpoint.
- [x] Show a `重试` action only for `failed` jobs.
- [x] Disable the retry button while its request is in flight.
- [x] Refresh tasks and jump to page 1 after success.
- [x] Run focused Biome check on touched files.

## Chunk 3: Verification And Commit

### Task 3: Verify and commit

**Files:**
- Modified implementation files and this plan.

- [x] Run `pnpm --filter @omniknight/backend typecheck`.
- [x] Run `pnpm --filter @omniknight/web build`.
- [x] Filtered `pnpm --filter @omniknight/web typecheck` output for `Tasks.tsx`; only the existing Hono client `summaries` typing error on the delete action remains.
- [x] Run `pnpm exec biome check apps/backend/src/routes/summaries.ts apps/web/src/pages/Tasks.tsx`.
- [x] Run `git diff --check`.
- [x] Commit with `feat: add failed job retry`.
