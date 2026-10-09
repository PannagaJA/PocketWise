# Testing Strategy & Verification

## Test Runner & Environment
- **Framework:** Jest 29.7.0 with `ts-jest` / Babel transform.
- **Coverage Command:** `npm test`
- **Coverage Command:** `npm test`
- **Current Status:** 12 test suites passing, 89 unit & integration tests passing (Milestone 1 Verified).

## Test Suites Breakdown
1. `__tests__/finance.test.ts`: Currency conversion, integer arithmetic, minor unit parsing.
2. `__tests__/smsParser.test.ts`: Bank SMS regex matching for HDFC, SBI, ICICI, Axis, Kotak, PayTM, PhonePe, and Google Pay with duplicate detection fingerprinting.
3. `__tests__/shakeService.test.ts`: Shake detection calculations, sensitivity thresholds, debouncing, and event emission.
4. `__tests__/notifications.test.ts`: Notification engine channel priority, deduplication, quiet hours suppression, and trigger scheduling.
5. `__tests__/stage1_database_integrity.test.ts`: Account balance calculation triggers, cloud lends sync, and atomic transfers.
6. `__tests__/stage2_recurrence.test.ts`: Subscription billing cycle rollover, bill recurrence regeneration, and category filtering.
7. `__tests__/stage3_fcm_notifications.test.ts`: FCM HTTP v1 payload formatting, dead token deactivation, and scheduled reminder dispatch.
8. `__tests__/stage4_modules.test.ts`: Core modules and security interfaces.
9. `__tests__/stage4_offline_outbox_security.test.ts`: Outbox queue serialization, dead-letter storage, auto-lock timeout, and biometrics.
10. `__tests__/stage5_reports_export.test.ts`: CSV statement generation, formula injection escaping, date-range export queries, and share actions.
11. `__tests__/stage5_security.test.ts`: PIN hashing, lockout delay logic, biometric fallback checks.
12. `__tests__/stage6_reports.test.ts`: Financial report aggregates, savings rate calculation, and category distribution formulas.

## Completed Verification
- [x] Database transaction balance rollback tests (simulating concurrent mutations).
- [x] Offline outbox queue serialization and replay tests with mutex protection.
- [x] Subscription next billing date recurrence cycle calculation tests.
- [x] Formula injection protection and CSV generation tests.
