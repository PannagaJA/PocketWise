# UI Design Contract: Magpie-Inspired Cards, Records, Typography & Surfaces

**Phase:** Phase 09 — Magpie UI Redesign: Cards, Records, Typography & Surfaces  
**Project:** PocketWise (Personal Finance & Subscription Tracker)  
**Reference Benchmark:** Magpie App Instagram Reel / Luxury Mobile UI  
**Status:** Approved Specification  

---

## 1. Executive Summary & Design Benchmark

PocketWise's screens and components will be visually elevated to faithfully match the clean, premium, high-contrast aesthetic demonstrated in the Magpie reference Reel. 

This redesign standardizes:
1. **Screen Canvas & Backgrounds:** Warm off-white canvas with a subtle lavender undertone (`#F8F9FE`).
2. **Card Surfaces:** Pure white content cards (`#FFFFFF`) with generous rounded corners (`borderRadius: 20px - 24px`), ultra-subtle borders (`border-zinc-100` / `rgba(0,0,0,0.05)`), zero heavy muddy drop shadows, and standardized internal padding (`p-4` to `p-5`).
3. **Typography Hierarchy:** Authoritative high-contrast titles (`#09090B`), uppercase tracked metadata headers (`#71717A`), and crisp right-aligned amounts.
4. **Records & List Rows:** Unified `44×44px` circular category icon containers with soft pastel tints, two-line title/metadata hierarchy with centered dot separators, and right-aligned amount with date underneath.
5. **Progress & Indicators:** Modern slim progress tracks (`h-2` / `h-2.5` with `rounded-full` and `bg-zinc-100`) with sleek vibrant fills.

---

## 2. Protected Component Invariants (STRICT ZERO-TOUCH BOUNDARIES)

1. **Logo & Startup Animation:** `components/splash/AnimatedSplashScreen.tsx` and its banknote illustration remain 100% untouched.
2. **Dashboard Account-Card Stack:** `components/dashboard/LayeredCardStack.tsx` and `components/dashboard/AtmCardVisual.tsx` (appearance, stack layering, card gradients, swipe gestures, balance typography, and behavior) remain 100% untouched.
3. **Floating Pill Navigation:** `components/CustomBottomTabBar.tsx` remains 100% untouched.
4. **Core Business Logic & Schema:** Financial formulas (`lib/finance/core.ts`, `analyticsEngine.ts`, `dashboard.calculations.ts`), Supabase database schemas, auth, and API contracts remain untouched.
5. **Git Safety Rule:** NO git commits or staging operations.

---

## 3. Design System & Design Tokens

### 3.1 Color Palette
| Token Name | Hex Value | Application |
| :--- | :--- | :--- |
| `canvas-bg` | `#F8F9FE` | Screen canvas background (warm off-white with lavender undertone) |
| `card-surface` | `#FFFFFF` | Crisp, pure white card and panel surface |
| `card-border` | `#F4F4F5` / `rgba(0,0,0,0.05)` | Hairline neutral border (`1px`) |
| `text-primary` | `#09090B` | Primary headings, merchant titles, expense amounts |
| `text-secondary` | `#71717A` | Subtitles, bank metadata, dates, secondary labels |
| `text-muted` | `#A1A1AA` | Placeholder text, disabled labels |
| `accent-primary` | `#6366F1` | "See All" text action links, primary indicators |
| `accent-income` | `#10B981` | Positive cashflow amount (`+₹...`), credit badges |
| `badge-neutral` | `#F4F4F5` | Bank of Baroda filter pill, status badges |

### 3.2 Typography Tokens
| Hierarchy Level | Font Size | Weight | Tracking | Color |
| :--- | :--- | :--- | :--- | :--- |
| **Greeting Label** | `11px` | `700` (Bold) | `0.6px` (Uppercase) | `#71717A` |
| **User Display Name** | `18px` | `800` (Extrabold) | `0px` | `#09090B` |
| **Page Title** | `22px` | `800` (Extrabold) | `-0.4px` | `#09090B` |
| **Section Heading** | `17px` | `800` (Extrabold) | `-0.2px` | `#09090B` |
| **Section Action Link** | `13px` | `700` (Bold) | `0px` | `#6366F1` |
| **Badge / Filter Pill** | `11px` | `600` (Semibold) | `0.2px` | `#52525B` |
| **Record Title** | `15px` | `700` (Bold) | `-0.1px` | `#09090B` |
| **Record Subtitle** | `12px` | `500` (Medium) | `0px` | `#71717A` |
| **Record Amount** | `15px` | `800` (Extrabold) | `-0.2px` | `#09090B` / `#10B981` |
| **Record Date** | `11px` | `500` (Medium) | `0px` | `#71717A` |

### 3.3 Circular Category Icon Containers
Standardized dimension: `44×44px`, `borderRadius: 22px`, centered flexbox:
- **Expense / Debit:** Background `#FEF2F2` (Rose-50), Icon: `ArrowUpRight` `#EF4444` (18px, strokeWidth 2.5).
- **Income / Credit:** Background `#ECFDF5` (Emerald-50), Icon: `ArrowDownLeft` `#10B981` (18px, strokeWidth 2.5).
- **Bills / Calendar:** Background `#FFFBEB` (Amber-50), Icon: `Calendar` `#D97706` (18px).
- **Subscriptions / Recurring:** Background `#EEF2FF` (Indigo-50), Icon: `Repeat` `#4F46E5` (18px).
- **Goals / Savings:** Background `#F5F3FF` (Purple-50), Icon: `Target` `#7C3AED` (18px).
- **Lends / Debts:** Background `#F0FDFA` (Teal-50), Icon: `Users` / `Repeat` `#0D9488` (18px).

---

## 4. Screen-by-Screen Redesign Specifications

### 4.1 Dashboard (`app/(tabs)/index.tsx`)
- **Canvas:** Replace gray/neutral backgrounds with `#F8F9FE`.
- **Header:**
  - Left: Circular avatar (`40×40px`, background `#EDE9FE`, bold purple initial letter).
  - Center/Left stack: `"GOOD MORNING"` (`11px font-bold tracking-wider text-zinc-500 uppercase`) and `"Pannaga J A"` (`18px font-extrabold text-zinc-950`).
  - Right: Circular notification bell button with unread dot.
- **Card Stack:** ISOLATED & UNTOUCHED (`LayeredCardStack`).
- **Quick Action Row:**
  - 4 circular action buttons: Analytics (`#EEF2FF` / `#4F46E5`), Lends (`#ECFDF5` / `#0D9488`), Goals (`#F5F3FF` / `#7C3AED`), Bills (`#FFFBEB` / `#D97706`).
  - Labels below circles: `12px font-bold text-zinc-900`.
- **Recent Transactions Section:**
  - Container: White card (`bg-white rounded-3xl p-5 border border-zinc-100 shadow-xs`).
  - Header: `"Recent Transactions"` (`17px font-extrabold text-zinc-950`), Bank badge pill (`#F4F4F5` with bank name), and `"See All"` text button (`#6366F1`).
  - Rows: Exact Magpie layout with `44×44px` circular tinted container, title, dot-separated category/bank, right-aligned amount and date.
- **Upcoming Bills Section:**
  - Matching white card surface with amber calendar icons and payment reminder status.

### 4.2 Transactions List Screen (`app/(tabs)/transactions.tsx`)
- **Canvas:** `#F8F9FE`.
- **Search & Filter:**
  - Modern search bar in `#F4F4F5` with `#71717A` placeholder and search icon.
  - Horizontally scrollable filter pills with active state (`bg-zinc-900 text-white`) and resting state (`bg-white border border-zinc-200 text-zinc-600`).
- **Transaction Cards & Rows:**
  - Render list items inside unified white grouped surfaces with subtle separators, circular category containers, and aligned typography.
  - Preserve all swipe actions, edit modals, and search filtering.

### 4.3 Subscriptions Screen (`app/(tabs)/subscriptions.tsx`)
- **Canvas:** `#F8F9FE`.
- **Summary Header:**
  - Clean white card displaying total monthly recurring commitment, active subscription count, and upcoming renewal count.
- **Subscription Cards:**
  - Pure white cards (`bg-white rounded-2xl p-4.5 border border-zinc-100 shadow-xs`).
  - Circular service icon, service name (`16px font-bold text-zinc-900`), billing frequency pill (`Monthly` / `Yearly`), renewal countdown, and amount (`font-extrabold text-zinc-900`).

### 4.4 Budgets Screen (`app/(tabs)/budgets.tsx`)
- **Canvas:** `#F8F9FE`.
- **Monthly Overview Card:**
  - Total budget vs total spent card with percentage spent pill and clean slim progress track.
- **Category Budget Cards:**
  - Category icon in circular pastel container.
  - Category title, amount spent vs limit (`₹4,200 of ₹10,000`).
  - Modern progress track: `h-2 rounded-full bg-zinc-100 overflow-hidden` with dynamic color (indigo when safe, amber when >80%, rose when exceeded).
  - Remaining limit label (`₹5,800 remaining`).

### 4.5 Savings Goals Screen (`app/goals.tsx`)
- **Canvas:** `#F8F9FE`.
- **Summary Banner:**
  - Total saved across all active goals.
- **Goal Cards:**
  - White surface card with target icon, goal title, target amount, current saved amount.
  - Slim progress track with percentage complete badge.
  - Target date countdown (`5 months left`).
  - Restrained action buttons (`+ Add Money` in dark pill, `Edit` in soft neutral pill).

### 4.6 Bills & Reminders Screen (`app/bills.tsx`)
- **Canvas:** `#F8F9FE`.
- **Bill Cards:**
  - Amber calendar icon badge with due date badge (`Due in 3 days` / `Overdue`).
  - Bill title, recurring frequency, bill amount.
  - Quick action: `"Mark Paid"` button with subtle haptic feedback.

### 4.7 Lends & Debts Screen (`app/lends.tsx`)
- **Canvas:** `#F8F9FE`.
- **Net Balance Panel:**
  - Two-column or side-by-side summary: `"You are owed"` (emerald `#10B981`) vs `"You owe"` (rose `#EF4444`).
- **Person Cards:**
  - Avatar / initial circle, counterparty name, direction indicator with soft colored pill, amount, and settle button.

### 4.8 Reports & Analytics Screen (`app/reports.tsx`)
- **Canvas:** `#F8F9FE`.
- **Metrics Summary Cards:**
  - Income, Expense, and Net Savings cards rendered in clean white surfaces with subtle category accents.
  - Category breakdown bars with consistent Magpie typography and aligned percentages.

### 4.9 More / Settings Screen (`app/(tabs)/more.tsx`)
- **Canvas:** `#F8F9FE`.
- **Grouped Surfaces:**
  - Account & Security, Preferences, Data & Storage sections rendered as grouped white rounded cards with clean rows, icons, and right chevrons.

---

## 5. Reusable Component Upgrades

### 5.1 `components/ui/Card.tsx`
Standardize default Card to Magpie specifications:
```tsx
export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => (
  <View
    className={`bg-white rounded-3xl p-5 border border-zinc-100 shadow-xs ${className}`}
    {...props}
  >
    {children}
  </View>
);
```

### 5.2 `components/ui/RecordRow.tsx` (Shared Primitive)
Create a reusable row primitive that guarantees 100% visual parity across Dashboard, Transactions, Bills, and Subscriptions:
```tsx
interface RecordRowProps {
  title: string;
  subtitle: string;
  amount: number | string;
  isCredit?: boolean;
  date?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  onPress?: () => void;
  badge?: React.ReactNode;
}
```

---

## 6. Verification & Acceptance Criteria

1. **Magpie Visual Parity:** All cards, transaction rows, section headers, badges, and progress bars match the exact visual language of `media_1792127614064.png`.
2. **Protected Components Untouched:**
   - `components/splash/AnimatedSplashScreen.tsx` remains completely untouched.
   - `components/dashboard/LayeredCardStack.tsx` & `AtmCardVisual.tsx` remain completely untouched.
3. **No Loss of Functionality:** All existing queries, mutations, modals, navigation routes, offline outbox, and push notifications work seamlessly.
4. **Zero Compilation Errors:** `npx tsc --noEmit` returns 0 errors.
5. **Full Test Suite Passing:** `npm test` passes all test suites.
6. **No Git Staging/Commits:** Working tree changes kept clean without committing.
