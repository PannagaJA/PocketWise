# Phase 1 Plan: Database Integrity & Cloud Lends Migration

## Plan Overview
- **Phase:** Phase 1
- **Goal:** Harden database transactions with atomic balance triggers and migrate `lends` to Supabase PostgreSQL.
- **Estimated Wave:** 2 Waves (Wave 1: Database & Services, Wave 2: UI & Verification)

---

## Tasks

### Wave 1: Database Schema & Service Hardening

- [ ] **Task 1.1: Database Schema Enhancement (`supabase_schema.sql`)**
  - Add `public.lends` table schema with RLS and indexes.
  - Add `sync_account_balance()` PostgreSQL trigger function handling `INSERT`, `UPDATE`, and `DELETE` on `transactions` (including `income`, `expense`, and `transfer`).
  - Add triggers: `trg_sync_account_balance` on `transactions`.

- [ ] **Task 1.2: Refactor `transaction.service.ts` for Atomic Balances**
  - Remove fragile client-side `accountService.updateAccountBalance(...)` manual invocations in `createTransaction`.
  - Add `updateTransaction` and `deleteTransaction` methods that mutate `transactions` while relying on database triggers for balance consistency.

- [ ] **Task 1.3: Refactor `lend.service.ts` to Supabase**
  - Implement Supabase CRUD (`getLends`, `createLend`, `updateLend`, `markCollected`, `deleteLend`).
  - Add automatic one-time migration of any legacy `AsyncStorage` records to Supabase when a user signs in.
  - Maintain notifications scheduling alongside cloud storage.

---

### Wave 2: UI Integration & Test Verification

- [ ] **Task 2.1: Update `app/lends.tsx` for Cloud Lends & TanStack Query**
  - Bind `app/lends.tsx` to `useQuery` with `['lends', user?.id]` using `lendService.getLends(user.id)`.
  - Connect Add, Reschedule, Collect, and Delete mutations to `useMutation` with automatic query invalidation.

- [ ] **Task 2.2: Unit & Integration Tests**
  - Create `__tests__/stage1_database_integrity.test.ts` to test balance synchronization, atomic transaction math, and lend cloud service operations.
  - Ensure all existing and new test suites pass (`npm test`).

---

## Verification Criteria
1. `npm test` runs with 100% pass rate across all test suites.
2. `npx tsc --noEmit` exits with 0 errors.
3. `supabase_schema.sql` contains the complete `lends` table, RLS policies, and `sync_account_balance()` trigger function.
4. Lends data in `app/lends.tsx` is tied to Supabase and reactive via TanStack Query.
