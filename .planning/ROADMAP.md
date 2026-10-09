# Roadmap & Phases

## Milestone 1: Production Hardening & Core Architecture (Current)

### Phase 1: Database Integrity & Cloud Lends Migration (Completed)
- **Goal:** Ensure 100% data integrity with PostgreSQL atomic balance triggers and migrate `lends` to Supabase table.
- **Plans:**
  - [x] 01-01: Create Supabase PostgreSQL atomic balance sync triggers (`sync_account_balance`).
  - [x] 01-02: Create `public.lends` table with RLS and update `lend.service.ts` to sync with cloud.

### Phase 2: Transaction Lifecycle & Recurrence Automation (Completed)
- **Goal:** Enable editing and deletion of transactions with balance reversals, plus subscription & recurring bill date rollover.
- **Plans:**
  - [x] 02-01: Transaction Edit & Soft-Delete modal with balance rollback.
  - [x] 02-02: Subscription renewal auto-advance & "Mark Renewed" action.
  - [x] 02-03: Recurring bill regeneration on payment completion.

### Phase 3: Push Notification Modernization (FCM HTTP v1) (Completed)
- **Goal:** Upgrade Supabase Edge Function to Google FCM HTTP v1 OAuth2 API and configure cron scheduler.
- **Plans:**
  - [x] 03-01: Migrate Edge Function to FCM HTTP v1.
  - [x] 03-02: Set up Supabase `pg_cron` schedule for automated reminder dispatch.

### Phase 4: Offline Outbox & Security Hardening (Completed)
- **Goal:** Support offline transaction creation with automatic replay and polish App Lock background timeouts.
- **Plans:**
  - [x] 04-01: Implement offline mutation outbox queue in AsyncStorage.
  - [x] 04-02: App Lock background timer & security settings screen toggles.


### Phase 5: Reports Export & Production Release Gate (Completed)
- **Goal:** PDF/CSV financial report export, native Android 14/15 verification, and EAS build validation.
- **Plans:**
  - [x] 05-01: CSV/PDF export for transactions & reports.
  - [x] 05-02: EAS build test and release validation.

