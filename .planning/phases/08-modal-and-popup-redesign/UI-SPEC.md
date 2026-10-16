# UI Design Contract: Magpie-Inspired Modal & Popup System

**Phase:** Phase 08 — Modal & Popup System Redesign  
**Project:** PocketWise (Personal Finance & Subscription Tracker)  
**Reference Benchmark:** Magpie App Instagram Reel / Luxury Mobile UI  
**Status:** Approved Specification  

---

## 1. Executive Summary & Philosophy

PocketWise's existing modal dialogs and bottom sheets will be elevated into a unified, reference-matched modal design system inspired by the Magpie Reel. 

The new modal architecture replaces ad-hoc `<Pressable>` wrappers and mismatched modal headers across 33+ locations with a cohesive suite of five core primitives:
1. **`AppBottomSheet`** — Clean, white sliding bottom sheet with rounded top corners, centered drag pill, and keyboard-aware height constraint.
2. **`AppDialog`** — Compact, centered rounded card for short decision confirmations, warnings, and delete decisions.
3. **`AppLoadingIndicator`** — The signature Magpie two-dot alternating blue scaling/pulsing animation with concise contextual status messages.
4. **`AppTextInput`** — Formatted, focused input container for card credentials, currency, and clean labeled inputs.
5. **`AddCardModal`** — The benchmark reference flow featuring card number grouping, MM/YY expiry, CVV, validation, disabled submit state, and two-dot blue transition.

### Protected Component Invariants (Strict Boundaries)
- **Starting Logo / Splash Animation:** `AnimatedSplashScreen.tsx` remains 100% untouched.
- **Dashboard Account-Card Stack:** `LayeredCardStack.tsx` & `AtmCardVisual.tsx` remain 100% untouched.
- **Financial Calculations & Business Logic:** Core algorithms (`analyticsEngine.ts`, `dashboard.calculations.ts`), queries, mutations, and Supabase database schemas remain untouched.
- **Navigator Integrity:** No secondary `NavigationContainer`; Expo Router tab and stack structure remains untouched.

---

## 2. Design Tokens & Visual Hierarchy

| Token | Value | Purpose |
| :--- | :--- | :--- |
| **Backdrop Overlay** | `rgba(0, 0, 0, 0.52)` | Translucent dark dimming; keeps background recognizable |
| **Sheet Background** | `#FFFFFF` | Crisp, pure white surface |
| **Sheet Border Radius** | `28px` top-left, `28px` top-right | Generous, modern rounded top corners |
| **Dialog Border Radius** | `24px` all corners | Balanced rounded rectangle for centered dialogs |
| **Drag Handle Dimensions** | `width: 36px`, `height: 4px`, `borderRadius: 2px` | Minimalist centered pill indicator |
| **Drag Handle Color** | `#E4E4E7` (Zinc-200) | Subtle, non-distracting drag affordance |
| **Primary Typography** | `fontSize: 20px`, `fontWeight: '800'`, `#09090B` | Clear, authoritative modal heading |
| **Secondary Typography**| `fontSize: 13px`, `fontWeight: '500'`, `#71717A` | Subtle secondary labels and hints |
| **Input Background** | `#F4F4F5` (Zinc-100) / Active: `#FFFFFF` | Soft gray resting surface, bright active focus |
| **Input Border** | `1px solid #E4E4E7` / Focus: `1.5px solid #6366F1` | Restrained neutral border with indigo/violet focus ring |
| **Primary Button** | Background: `#09090B`, Text: `#FFFFFF` | Authoritative dark pill button with `borderRadius: 9999` |
| **Disabled Button** | Background: `#E4E4E7`, Text: `#A1A1AA` | Clear, non-clickable state until form validation passes |
| **Accent Loader Dots** | `#3B82F6` (Electric Blue / Azure) | The signature two-dot loading animation color |

---

## 3. Motion & Animation System

### 3.1 Bottom Sheet Entrance & Dismissal
- **Backdrop Fade:** 180ms ease-out timing curve (`0 -> 1` opacity).
- **Sheet Slide:** Spring animation (`damping: 28`, `stiffness: 350`, `mass: 0.7`) translating from `screenHeight` to `0`.
- **Drag-to-Dismiss Gesture:** Pan responder tracks vertical drag:
  - If `dragY > 60px` or `velocity > 0.4`, dismiss sheet with haptic feedback (`Haptics.impactAsync(Light)`).
  - Otherwise, smoothly snap back to `y = 0`.

### 3.2 The Signature Magpie Two-Dot Blue Loading Animation
When a modal form is submitted (e.g. Add Card, Save Transaction, Update Budget):
1. The sheet content cross-fades into the centered loading state within 150ms.
2. The bottom sheet remains pinned in place with the dimmed backdrop preserved.
3. Two small electric blue circles (`size: 10px`, `borderRadius: 5px`, `color: #3B82F6`) sit horizontally with `gap: 12px`.
4. **Animation Cycle (800ms looping keyframe):**
   - **Dot 1:** Scales `1.0 -> 1.45 -> 1.0` while opacity modulates `0.4 -> 1.0 -> 0.4`.
   - **Dot 2:** Staggered by 250ms; scales `1.0 -> 1.45 -> 1.0` while opacity modulates `0.4 -> 1.0 -> 0.4`.
   - Interpolation uses smooth sine-wave easing for fluid, organic alternation.
5. Below the dots, concise status typography (`fontSize: 14px`, `fontWeight: '600'`, color: `#09090B`) displays the action (e.g. `"Adding your card..."`).
6. **No Fake Delays:** Stays active exactly as long as the real asynchronous mutation takes; gracefully handles error by returning to editable form.

---

## 4. Reusable Component Contracts

### 4.1 `AppBottomSheet`
```tsx
interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  showDragHandle?: boolean;
  dismissOnBackdrop?: boolean;
  children: React.ReactNode;
}
```
- Built directly on top of `AppModal.tsx` foundation.
- Automatically renders the top drag handle pill and standard header with title & close button.
- Handles keyboard height avoidance, safe area margins, and hardware back gesture.

### 4.2 `AppDialog`
```tsx
interface AppDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'destructive';
  cancelLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
}
```
- Designed for confirmations, warnings, and delete decisions (e.g., delete subscription, sign out, clear notifications).
- Centered rounded card (`borderRadius: 24`, `maxWidth: 340`).

### 4.3 `AppLoadingIndicator`
```tsx
interface AppLoadingIndicatorProps {
  message?: string;
  compact?: boolean;
}
```
- Reusable two-dot electric blue alternating loader with smooth scale & opacity worklets.
- Can be rendered standalone inside sheets or inline in panels.

### 4.4 `AppTextInput`
```tsx
interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  formatType?: 'card-number' | 'expiry' | 'cvv' | 'currency' | 'default';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```
- Auto-formats card digits (`XXXX XXXX XXXX XXXX`), expiry dates (`MM/YY`), and CVV (`XXX` or `XXXX`).
- Restrained luxury styling with active indigo focus border.

---

## 5. Add Card Modal Flow (Reference Implementation)

Located at `components/AddCardModal.tsx`:
1. **Header:** Centered drag handle + `"Add Card"` bold title + subtitle `"Enter your card details to link an account"`.
2. **Fields:**
   - Cardholder Name (defaults to user display name)
   - Card Number (16-digit spaced formatting with real-time card brand detection: Visa, Mastercard, RuPay, Amex)
   - Expiry Date (`MM/YY` auto-slash formatting)
   - CVV (`3` or `4` masked digits)
   - Linked Bank Selection dropdown (selects from existing supported banks: HDFC, ICICI, SBI, Axis, Baroda, etc.)
3. **Primary Action:**
   - Pill button `"Add Card"` (`height: 52px`, `borderRadius: 9999`).
   - Disabled until card number (16 digits), valid MM/YY, CVV (3+ digits), and bank are provided.
4. **Submission Phase:**
   - Transitions immediately to `AppLoadingIndicator` with `"Adding your card..."`.
   - Creates/links account via `accountService.createAccount(...)` or adds visual card credential.
   - On success: Success notification haptic, automatic sheet dismissal, and dashboard balance cache invalidation.
   - On error: Reverts to form with inline error banner.

---

## 6. Comprehensive Application Modal Audit & Migration Plan

| Screen / Feature | Current Implementation | Target Component | Status Message |
| :--- | :--- | :--- | :--- |
| **Add Card** | *New Reference Flow* | `AddCardModal` + `AppBottomSheet` | `"Adding your card..."` |
| **Quick Expense (Shake)** | `QuickExpenseModal.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Recording expense..."` |
| **Record Transaction** | `RecordTransactionModal.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Saving transaction..."` |
| **Transaction Detail / Edit** | `TransactionDetailModal.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Updating transaction..."` |
| **SMS Onboarding** | `SmsOnboardingCard.tsx` | `AppBottomSheet` | — |
| **SMS Review** | `SmsTransactionReviewModal.tsx`| `AppBottomSheet` + `AppLoadingIndicator` | `"Confirming transaction..."` |
| **Date & Time Pickers** | `DatePickerModal.tsx`, `TimePickerModal.tsx` | `AppBottomSheet` | — |
| **Subscriptions (Add/Edit)** | `app/(tabs)/subscriptions.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Saving subscription..."` |
| **Budgets (Add/Edit)** | `app/(tabs)/budgets.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Updating budget limit..."` |
| **Goals (Add/Edit)** | `app/goals.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Saving savings goal..."` |
| **Bills & Reminders** | `app/bills.tsx` | `AppBottomSheet` + `AppLoadingIndicator` | `"Scheduling bill reminder..."` |
| **Bank Selection Drawer** | `app/(tabs)/index.tsx` | `AppBottomSheet` | — |
| **Notifications Drawer** | `app/(tabs)/index.tsx` | `AppBottomSheet` | — |
| **Delete / Sign Out Dialogs**| Various inline modals & alerts | `AppDialog` | `"Removing item..."` |

---

## 7. Verification & Acceptance Gates

1. **Visual Parity:** Bottom sheets feature clean 28px rounded corners, centered drag handle, pure white backdrop, and 52% dimmed overlay.
2. **Two-Dot Blue Loader:** The alternating blue dots animate with organic sine easing and scale between 1.0 and 1.45 during actual network requests.
3. **Zero Form Overlap:** Form buttons and inputs remain 100% visible and accessible above keyboard on iOS and Android.
4. **Protected Guard:** Splash screen banknote animation and dashboard card stack remain untouched.
5. **Quality Gates:** 100% passing test suites (`npm test`) and 0 TypeScript compilation errors (`tsc --noEmit`).
