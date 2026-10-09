# Phase 1: Context & Boundaries

## Goals
1. Establish atomic database integrity for all financial balances.
2. Elevate `lends` to a first-class cloud-persisted entity in Supabase.
3. Remove client-side race conditions in balance calculations.

## In Scope
- PostgreSQL trigger function `sync_account_balance()` in `supabase_schema.sql`.
- `public.lends` table definition, RLS policies, and index in `supabase_schema.sql`.
- Migration & update in `lib/services/lend.service.ts` to query Supabase with `user_id`.
- Update in `lib/services/transaction.service.ts` to leverage atomic trigger and remove fragile client-side balance math.
- Update `app/lends.tsx` and `app/(tabs)/index.tsx` for real-time reactive lends loading.
- Comprehensive test coverage for triggers and lend operations.

## Out of Scope
- FCM HTTP v1 migration (Phase 3).
- Offline outbox queue (Phase 4).
- Reports CSV/PDF export (Phase 5).
