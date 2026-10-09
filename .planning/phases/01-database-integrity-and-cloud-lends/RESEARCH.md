# Phase 1: Research — Database Integrity & Cloud Lends

## Current State Analysis

### 1. Account Balance Calculation Flaw
- **Location:** `lib/services/transaction.service.ts` (`createTransaction`) and `lib/services/account.service.ts`.
- **Problem:** Currently, when a transaction is added, the app inserts the transaction, queries the balance from `accounts`, performs arithmetic in JS, and executes an `UPDATE accounts SET balance = ...`.
- **Risks:**
  1. Concurrency collision: Two simultaneous inserts (e.g. background SMS parse + user manual entry) will overwrite each other's balance calculation.
  2. Incomplete transaction: If the network fails between inserting the transaction and updating the account balance, the account balance is never updated.
  3. No rollback on delete/edit: Deleting or editing a transaction requires manual balance reversal.
- **Solution:** PostgreSQL Trigger `trg_sync_account_balance` attached to `transactions` table executing `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW`.
  - On `INSERT`:
    - `income`: `UPDATE accounts SET balance = balance + NEW.amount_minor WHERE id = NEW.account_id;`
    - `expense`: `UPDATE accounts SET balance = balance - NEW.amount_minor WHERE id = NEW.account_id;`
    - `transfer`: `UPDATE accounts SET balance = balance - NEW.amount_minor WHERE id = NEW.account_id;` (and destination row handles its addition).
  - On `DELETE` (or soft delete):
    - Reverses the exact opposite arithmetic.
  - On `UPDATE`:
    - Undoes `OLD` effect and applies `NEW` effect.

### 2. Lends Architecture Gap
- **Location:** `lib/services/lend.service.ts` and `app/lends.tsx`.
- **Problem:** Lends are currently stored only in `AsyncStorage` (`pocketwise_lend_records_v1`). If the user logs in from another device or clears app data, all records are permanently lost.
- **Solution:** Add `public.lends` table to `supabase_schema.sql` with:
  ```sql
  CREATE TABLE IF NOT EXISTS public.lends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    amount_minor BIGINT NOT NULL,
    type TEXT NOT NULL DEFAULT 'lend' CHECK (type IN ('lend', 'borrow')),
    lent_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'collected', 'overdue')),
    notes TEXT,
    notification_id TEXT,
    collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE public.lends ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can manage their own lends" ON public.lends FOR ALL USING (auth.uid() = user_id);
  ```
- **Migration Path:**
  - `lend.service.ts` checks for any existing items in `AsyncStorage` on initialization, uploads them to Supabase under the user's ID, and then uses Supabase as source-of-truth with TanStack Query caching.

### 3. Dependencies & Compatibility
- Supabase JS client `^2.112.2` already installed and initialized.
- TanStack Query v5 configured with `queryClient.invalidateQueries()`.
- Jest test suite configured with 56 passing tests.
