# Phase 2: Research — Transaction Lifecycle & Recurrence Automation

## Current State Analysis

### 1. Transactions Screen (`app/(tabs)/transactions.tsx`)
- Currently renders `TransactionItem` with read-only display.
- Has a modal for creating new transactions (`RecordTransactionModal` / in-line modal).
- **Missing:**
  - On-press or swipe action to Edit transaction (amount, category, description, date, account).
  - On-press or swipe action to Delete transaction with confirmation dialog.
  - Integration with `transactionService.updateTransaction` and `transactionService.deleteTransaction` (which trigger automatic PostgreSQL balance adjustments).

### 2. Subscriptions Management (`lib/services/subscription.service.ts`, `app/(tabs)/subscriptions.tsx`)
- `subscription.service.ts` currently only has `getSubscriptions`, `createSubscription`, and `deleteSubscription`.
- **Missing:**
  - `renewSubscription(subId, accountId)`:
    - Calculates the new `next_billing_date` from the previous date:
      - `weekly`: +7 days
      - `monthly`: +1 month (handling month-end edge cases e.g. Jan 31 -> Feb 28)
      - `quarterly`: +3 months
      - `half_yearly`: +6 months
      - `yearly`: +1 year
    - Creates an expense transaction in `transactions` linked to the chosen account and subscription category.
    - Updates the subscription row with the new `next_billing_date`.
    - Reschedules the upcoming reminder notification.
  - `updateSubscription(subId, updates)` for editing name, amount, billing cycle, or pausing status.
  - UI button in `subscriptions.tsx` for "Mark Renewed / Log Payment" and Edit modal.

### 3. Bills Management (`lib/services/bill.service.ts`, `app/bills.tsx`)
- `bill.service.ts` currently marks the bill as paid and creates an expense transaction.
- **Missing:**
  - Automatic recurrence generation: If `bill.frequency === 'monthly'` or `'yearly'`, upon payment mark, calculate the next due date (+1 month or +1 year) and insert a new pending bill with its associated reminder.
  - `updateBill(billId, updates)` to edit expected amount, due date, frequency, or name.
  - Edit modal and recurring indicators in `app/bills.tsx`.

## Date Math Best Practices
- Use date-only strings (`YYYY-MM-DD`) and avoid UTC timezone shifts by operating on year, month, and day parts explicitly.
- Month rollover logic: `new Date(year, month + 1, day)` with clamp to last day of month if overflow occurs (e.g. March 31 -> April 30).
