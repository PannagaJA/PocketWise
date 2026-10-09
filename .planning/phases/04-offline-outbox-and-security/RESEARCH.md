# Phase 4: Research — Offline Outbox & Security Hardening

## Current State Analysis

### 1. Offline Mutation Outbox Gap
- **Current State:** TanStack React Query caches query responses for 7 days via `AsyncStorage` persister.
- **Problem:** If a user logs an expense while on airplane mode or in low-signal areas, `transactionService.createTransaction` throws `FetchError: Network request failed`, causing the transaction to be lost unless retried manually.
- **Solution (Outbox Pattern):**
  - Create `lib/services/outbox.service.ts`:
    - Stores pending mutations in `AsyncStorage` (`POCKETWISE_MUTATION_OUTBOX_V1`).
    - Exposes `enqueueMutation({ action, payload })`.
    - Exposes `processOutbox()` which iterates through pending items, calls the corresponding domain service, and removes succeeded items.
    - Listens to app focus / network reconnection and automatically flushes the queue.
  - In `transactionService`: If a network call fails due to connection issues, automatically push the transaction to the outbox and update local cache optimistically.

### 2. App Lock Background Inactivity Timer
- **Current State:** `components/AppLockGate.tsx` locks only upon cold start / initial mount.
- **Problem:** If the user leaves the app open in background, minimizes to check another app, and comes back 10 minutes later, the app is completely unlocked.
- **Solution:**
  - Track `backgroundTimestamp` in `AppState` change listener:
    - When `AppState` transitions from `active` -> `background` or `inactive`: record `Date.now()`.
    - When `AppState` transitions from `background` -> `active`: calculate `elapsedSeconds = (Date.now() - backgroundTimestamp) / 1000`.
    - If `elapsedSeconds >= lockTimeoutSeconds` (default: 30 seconds), set `isLocked = true` and prompt PIN / Biometric authentication.
  - Expose configurable timeout setting: `immediate` (0s), `30s`, `1m`, `5m`, `never`.
