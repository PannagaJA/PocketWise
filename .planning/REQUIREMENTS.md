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
