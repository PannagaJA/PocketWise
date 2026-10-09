# Phase 3 Plan: Push Notification Modernization (FCM HTTP v1 & Cron Scheduling)

## Plan Overview
- **Phase:** Phase 3
- **Goal:** Modernize Edge Function reminder processor to FCM HTTP v1 OAuth2 API and establish PostgreSQL scheduled cron dispatcher.
- **Estimated Waves:** 2 Waves (Wave 1: Edge Function & SQL Cron, Wave 2: Client Token Polish & Tests)

---

## Tasks

### Wave 1: Edge Function & Database Scheduler

- [ ] **Task 1.1: Refactor Edge Function to FCM HTTP v1 (`supabase/functions/process-reminders/index.ts`)**
  - Implement Google OAuth2 Service Account assertion signer using Web Crypto API.
  - Implement access token exchange (`https://oauth2.googleapis.com/token`).
  - Upgrade message dispatcher to `https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`.
  - Add Android channel ID (`pocketwise-reminders`) and APNs payload configurations.
  - Retain idempotency claim lock (`status = 'processing'`) and 3-attempt exponential backoff.

- [ ] **Task 1.2: PostgreSQL pg_cron & pg_net Dispatcher Setup (`supabase_schema.sql`)**
  - Add optional `pg_cron` schedule definition and instructions for Supabase Vault credentials.

---

### Wave 2: Client Device Registration & Test Verification

- [ ] **Task 2.1: Polish Device Token Registration (`lib/notifications/notification.service.ts`)**
  - Ensure device token upserts correctly track `platform`, `app_version`, `is_active`, and `last_used_at`.
  - Handle token deactivation when a device logs out.

- [ ] **Task 2.2: Automated Test Suite (`__tests__/stage3_fcm_notifications.test.ts`)**
  - Test FCM HTTP v1 message structure validation.
  - Test retry policy, attempt counting, and error handling.
  - Run `npm test` and `npx tsc --noEmit`.

---

## Verification Criteria
1. `npm test` runs with 100% pass rate across all test suites.
2. `npx tsc --noEmit` exits with 0 errors.
3. Edge Function `process-reminders` code is compliant with FCM HTTP v1 specifications.
4. Database schema includes `pg_cron` scheduler definitions.
