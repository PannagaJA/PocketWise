# Phase 5 Plan: Reports Export & Production Release Gate

## Plan Overview
- **Phase:** Phase 5 (Final Milestone Phase)
- **Goal:** Build financial report CSV/Text export service, attach export action into `app/reports.tsx`, and perform full production release validation across all milestones.
- **Estimated Waves:** 2 Waves (Wave 1: Export Service & UI Actions, Wave 2: Release Gate Test Suite & Verification)

---

## Tasks

### Wave 1: Export Engine & Reports UI
- [x] **Task 1.1: Build `export.service.ts`**
  - Implement `generateTransactionsCSV(transactions)` with RFC 4180 escaping.
  - Implement `generateFinancialReportText(summary, categories, period)`.
  - Provide `shareExport(content, filename)` using React Native `Share`.

- [x] **Task 1.2: Add Export Action to `app/reports.tsx`**
  - Add Export button in the top bar of the reports screen.
  - Show sheet/modal to choose between **Full CSV Statement** and **Summary Report**.

---

### Wave 2: Test Suite & Final Release Gate
- [x] **Task 2.1: Automated Test Suite (`__tests__/stage5_reports_export.test.ts`)**
  - Test CSV generation formatting, header mapping, and quote escaping.
  - Test summary statement formatting and date calculations.
  - Run full test suite (`npm test`) and typecheck (`npx tsc --noEmit`).

- [x] **Task 2.2: Production Release Audit**
  - Verify all 5 milestones completed in `.planning/ROADMAP.md` and `.planning/STATE.md`.
  - Update `CODEBASE_AUDIT_AND_PRODUCTION_IMPLEMENTATION_PLAN.md` with final release status.


---

## Verification Criteria
1. `npm test` runs with 100% pass rate across all test suites (Stage 1 to Stage 5).
2. `npx tsc --noEmit` exits with 0 errors.
3. Export service creates compliant CSV statements and shareable reports.
4. All user constraints maintained (no git commits or staging).
