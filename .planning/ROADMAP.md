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

## Milestone 2: Faithful UI, Splash Animation & Loading Redesign (Active)

### Phase 6: Splash Sequence & Startup Transition Architecture (Completed)
- **Goal:** Recreate faithful animated splash with original illustrated banknote artwork, orange rays, PocketWise branding, progress indicator, and seamless route transition without blank white flash.
- **Plans:**
  - [x] 06-01: Create illustrated banknote SVG artwork & animated splash screen component (`AnimatedSplashScreen.tsx`).
  - [x] 06-02: Wire startup orchestration in root `app/_layout.tsx` / `index.tsx` with genuine readiness tracking and smooth route reveal.

### Phase 7: Dashboard Visual Redesign & Layered Card-Stack Motion
- **Goal:** Redesign Dashboard with warm off-white canvas, greeting/profile header, overlapping payment-card stack (teal, orange, magenta, purple gradient) with spring motion, circular quick actions, and clean transaction panel.
- **Plans:**
  - [ ] 07-01: Implement layered card stack component with spring entrance motion, balance typography, and multi-card visual accents.
  - [ ] 07-02: Redesign Dashboard layout, action buttons, and transaction list while preserving 100% of underlying hooks, queries, and mutations.

### Phase 8: Floating Pill Navigation, Transitions & Global Loading Skeletons
- **Goal:** Modernize bottom tab navigation into floating pill style and replace generic spinners with component-matched skeleton loaders.
- **Plans:**
  - [ ] 08-01: Implement floating black pill bottom navigation bar with active state indicators and safe area handling.
  - [ ] 08-02: Create coordinated skeleton loaders matching redesigned dashboard and transaction cards.

### Phase 9: Verification, Polish & Regression Defense Gate
- **Goal:** Complete regression testing across all financial features, auth, biometric lock, push notifications, offline outbox, and run TypeScript/test/doctor suites.
- **Plans:**
  - [ ] 09-01: Full test suite verification, TypeScript clean check, and visual QA across Android and responsive views.

