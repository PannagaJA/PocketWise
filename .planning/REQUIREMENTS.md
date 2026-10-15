# Requirements & Feature Specifications

## Functional Requirements
- **FR-01 (Atomic Balances):** Account balances must always equal opening balance plus net transactions computed via atomic database triggers.
- **FR-02 (Cloud Lends):** Lend & Borrow records must sync to Supabase PostgreSQL under RLS.
- **FR-03 (Transaction CRUD):** Users must be able to Create, Read, Update, and Delete income, expense, and transfer transactions.
- **FR-04 (Subscription Recurrence):** Subscriptions must automatically advance `next_billing_date` upon scheduled billing date or manual renewal.
- **FR-05 (Bill Tracking):** Recurring bills must spawn the next scheduled bill instance when marked paid.
- **FR-06 (Push Delivery):** Cloud push reminders must be delivered via FCM HTTP v1 API.
- **FR-07 (Offline Outbox):** Transactions recorded while offline must be preserved and replayed when network reconnects.
- **FR-08 (App Security):** Biometric/PIN lock must protect access with configurable background timeout.
- **FR-09 (SMS Auto-Tracking):** Indian bank transaction SMS must be parsed, deduplicated, and presented for user review or auto-logged.
- **FR-10 (Shake-to-Log):** Accelerometer shake trigger must display quick expense modal.

## Milestone 2 Requirements (UI, Splash Animation & Loading Redesign)
- **FR-11 (Animated Splash Sequence):** Warm, near-white lavender-tinted splash with animated illustrated green banknote stack, orange accent rays, bold PocketWise wordmark, tagline, and progress fill tracking actual app initialization without arbitrary delay.
- **FR-12 (Seamless App Entry):** Transition from native splash to animated splash to target route (authenticated tabs or auth onboarding) without white flash or jank.
- **FR-13 (Dashboard Visual Hierarchy):** Clean greeting header, notifications & profile controls, circular quick actions, and clean transaction panel styled to match reference aesthetic.
- **FR-14 (Layered Card Stack Motion):** Overlapping payment-card stack featuring teal, orange, magenta, and prominent purple gradient cards with spring-based entrance motion and high-contrast balance typography.
- **FR-15 (Floating Pill Bottom Navigation):** Floating black pill-shaped tab bar with active indicator, clean icons, and safe area insets.
- **FR-16 (Matching Loading Skeletons):** Coordinated lightweight skeleton placeholders mirroring redesigned card stack and transaction items.
- **FR-17 (Preserved Interactions):** Full preservation of transaction CRUD, filters, account selection, modals, and gestures.
- **FR-18 (Zero Functionality Regression):** 100% preservation of Supabase auth, RLS, offline outbox, FCM push notifications, biometric lock, and financial calculations.
