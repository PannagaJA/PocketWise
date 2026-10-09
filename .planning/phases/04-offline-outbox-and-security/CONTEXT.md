# Phase 4: Context & Boundaries

## Goals
1. Provide seamless offline data entry with an automated outbox mutation buffer and replay worker.
2. Elevate app security with an intelligent background inactivity lock timer and user settings.

## In Scope
- Create `lib/services/outbox.service.ts` for buffering and executing pending mutations.
- Integrate `outboxService` into `lib/services/transaction.service.ts` for offline fallback.
- Enhance `components/AppLockGate.tsx` with `AppState` background duration tracking and auto-lock threshold.
- Update `app/(tabs)/more.tsx` / settings UI to allow selecting auto-lock timeout (`Immediately`, `30s`, `1m`, `5m`).
- Add comprehensive test suite `__tests__/stage4_offline_outbox_security.test.ts`.

## Out of Scope
- Full PDF/CSV financial report export (Phase 5).
- EAS production release builds (Phase 5).
