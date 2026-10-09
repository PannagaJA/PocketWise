# Phase 2: Context & Boundaries

## Goals
1. Complete the full CRUD lifecycle for transactions (Edit & Delete with automatic balance synchronization).
2. Automate recurrence for subscriptions (renew payment + advance next billing date).
3. Automate recurring bill regeneration on payment completion.

## In Scope
- Transaction Edit modal & Delete confirmation in `app/(tabs)/transactions.tsx` and `app/(tabs)/index.tsx`.
- Refactor `subscription.service.ts` to add `renewSubscription` and `updateSubscription`.
- Refactor `bill.service.ts` to add recurring bill auto-spawn and `updateBill`.
- UI updates in `app/(tabs)/subscriptions.tsx` (Renew Now button, Edit modal, Pause toggle).
- UI updates in `app/bills.tsx` (Edit modal, next cycle preview).
- Jest test suite for subscription date math, bill recurrence, and transaction edit/delete mutations.

## Out of Scope
- FCM HTTP v1 migration (Phase 3).
- Offline outbox queue (Phase 4).
- Reports CSV/PDF export (Phase 5).
