# Phase 4 Plan: Offline Outbox & Security Hardening

## Plan Overview
- **Phase:** Phase 4
- **Goal:** Build offline mutation outbox queue with auto-replay and harden App Lock with background inactivity timers.
- **Estimated Waves:** 2 Waves (Wave 1: Outbox Service & App Lock Timer, Wave 2: Settings UI & Tests)

---

## Tasks

### Wave 1: Outbox Queue & App Lock Background Timer

- [x] **Task 1.1: Build `outbox.service.ts`**
  - Implement AsyncStorage-backed FIFO mutation queue (`enqueue`, `peek`, `dequeue`, `processQueue`).
  - Support mutation types: `CREATE_TRANSACTION`, `UPDATE_TRANSACTION`, `DELETE_TRANSACTION`, `CREATE_LEND`, `CREATE_BILL`.
  - Connect to `transaction.service.ts` to seamlessly buffer when network is offline.

- [x] **Task 1.2: App Lock Background Inactivity Timer (`components/AppLockGate.tsx`)**
  - Listen to `AppState.addEventListener('change', ...)` for background duration tracking.
  - Re-lock the application if time in background exceeds configured threshold (default: 30s).

---

### Wave 2: Security Settings & Test Verification

- [x] **Task 2.1: Security Settings & Lock Timer Picker in `app/(tabs)/more.tsx`**
  - Add Lock Timeout Duration selector (`Immediately`, `30 seconds`, `1 minute`, `5 minutes`, `Never`).
  - Add Biometric unlock toggle.

- [x] **Task 2.2: Automated Test Suite (`__tests__/stage4_offline_outbox_security.test.ts`)**
  - Test outbox enqueue, storage serialization, and replay queue execution.
  - Test background duration elapsed timer calculation and lock decisions.
  - Run `npm test` and `npx tsc --noEmit`.


---

## Verification Criteria
1. `npm test` runs with 100% pass rate across all test suites.
2. `npx tsc --noEmit` exits with 0 errors.
3. Offline transactions are saved to outbox and processed upon network reconnection.
4. App lock automatically activates when returning from background after timeout.
