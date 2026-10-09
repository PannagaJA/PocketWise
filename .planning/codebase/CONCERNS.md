# Codebase Concerns & Technical Debt

## 1. Critical Architectural Risks (Resolved in Milestone 1)
1. **Non-Atomic Account Balances (Resolved):**
   - Implemented database-level PostgreSQL atomic balance sync triggers (`sync_account_balance()`) with `SECURITY DEFINER`, strict `search_path`, and `user_id` ownership constraints handling INSERT, UPDATE, DELETE, and transfer pairs atomically.
2. **Lends Data Isolation in AsyncStorage (Resolved):**
   - Migrated to Supabase `public.lends` table with strict Row Level Security policies, automated local-to-cloud migration on first login, and un-synced local data preservation.
3. **Deprecated Legacy FCM Push API (Resolved):**
   - Migrated Supabase Edge Function `process-reminders` to FCM HTTP v1 API using Google OAuth2 service account authentication, structured error inspection, and invalid token deactivation.

## 2. Feature Lifecycles (Resolved in Milestone 1)
1. **Transaction Edit / Delete (Resolved):**
   - Added full transaction edit and delete flows with atomic balance adjustments and transfer pair deletion synchronization via `transfer_group_id`.
2. **Subscription & Bill Recurrence Advancements (Resolved):**
   - Implemented `renewSubscription` and `markBillPaid` automatic cycle advancement, timestamp preservation, and duplicate payment prevention.
3. **Offline Mutation Queue (Resolved):**
   - Implemented serialized offline outbox queue with mutex protection, idempotent client-generated UUID upserts, retry backoff, and dead-letter queueing.

## 3. Platform & Security Considerations
1. **Android 14/15 Background Constraints:**
   - Background service permissions and notification channels verified in native plugins. Continuous monitoring recommended for future Android OS updates.
2. **Biometric & Lock Screen Polish (Resolved):**
   - Configurable background auto-lock timeout (Immediately, 30s, 1m, 5m), biometric retry capability, and PIN lockout mechanisms implemented.
