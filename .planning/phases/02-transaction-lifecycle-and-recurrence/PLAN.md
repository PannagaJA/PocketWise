# Phase 2 Plan: Transaction Lifecycle & Recurrence Automation

## Plan Overview
- **Phase:** Phase 2
- **Goal:** Enable editing and deletion of transactions with atomic balance reversals, plus subscription renewal rollover and recurring bill regeneration.
- **Estimated Waves:** 2 Waves (Wave 1: Services & Logic, Wave 2: UI & Verification)

---

## Tasks

### Wave 1: Domain Services & Recurrence Engine

- [ ] **Task 1.1: Enhance `subscription.service.ts`**
  - Implement `updateSubscription(id, updates)` to edit amount, cycle, category, status.
  - Implement `renewSubscription(subId, accountId)`:
    - Calculates next billing date according to cycle (`weekly`, `monthly`, `quarterly`, `half_yearly`, `yearly`).
    - Creates expense transaction for the payment.
    - Updates subscription row with new `next_billing_date`.
    - Reschedules push/local reminder for the new due date.

- [ ] **Task 1.2: Enhance `bill.service.ts` for Recurring Generation**
  - Implement `updateBill(id, updates)`.
  - Update `markBillPaid(billId, accountId)`:
    - Marks current bill `is_paid = true`.
    - Creates expense transaction for payment.
    - If `frequency` is `'monthly'` or `'yearly'`, automatically inserts the next bill cycle instance and schedules its reminder.

- [ ] **Task 1.3: Verify `transaction.service.ts` Edit & Delete Integration**
  - Ensure `updateTransaction` and `deleteTransaction` integrate with TanStack React Query cache invalidation and trigger-backed balance consistency.

---

### Wave 2: Screen UI & Test Verification

- [ ] **Task 2.1: Transaction Edit & Delete Modals in `app/(tabs)/transactions.tsx`**
  - Make transaction items pressable to open an action sheet / edit modal.
  - Provide Edit Amount, Description, Category, Date, and Account with form validation.
  - Provide Delete button with confirmation alert.

- [ ] **Task 2.2: Subscription Renew & Edit UI in `app/(tabs)/subscriptions.tsx`**
  - Add "Renew / Mark Paid" action button to active subscription cards.
  - Add Edit Subscription modal and Pause/Resume status toggle.

- [ ] **Task 2.3: Bill Edit Modal & Recurrence Indicators in `app/bills.tsx`**
  - Add Edit Bill modal.
  - Display recurring badge on bills.

- [ ] **Task 2.4: Comprehensive Test Suite (`__tests__/stage2_recurrence.test.ts`)**
  - Unit tests for date rollover algorithms (leap years, month-end dates, quarterly/half-yearly jumps).
  - Integration tests for `renewSubscription`, `markBillPaid` recurring generation, and transaction edit/delete.
  - Run `npm test` and `npx tsc --noEmit`.

---

## Verification Criteria
1. `npm test` runs with 100% pass rate.
2. `npx tsc --noEmit` exits with 0 errors.
3. Transactions can be edited and deleted with instant UI updates.
4. Subscriptions advance `next_billing_date` and log payment transactions upon renewal.
5. Recurring bills regenerate the next billing cycle upon payment.
