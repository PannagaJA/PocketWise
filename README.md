# 📱 PocketWise — Intelligent Personal Wealth & Finance Tracker

<p align="center">
  <img src="https://raw.githubusercontent.com/PannagaJA/PocketWise/main/assets/icon.png" width="96" height="96" alt="PocketWise Logo" />
</p>

<p align="center">
  <strong>A modern, offline-first personal finance platform built for speed, privacy, and proactive wealth management.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK_57-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/React_Native-0.86-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React Native 0.86" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/TanStack_Query-v5-FF4154?style=flat-square&logo=reactquery&logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/TailwindCSS-NativeWind_v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="NativeWind" />
  <img src="https://img.shields.io/badge/Tests-54_Passing-success?style=flat-square" alt="Tests Passing" />
</p>

---

## 🌟 Executive Overview

**PocketWise** is a production-grade, privacy-first personal wealth management and expense tracking mobile application designed for modern mobile workflows. Built with **React Native (Expo SDK 57)** and **Supabase**, PocketWise transforms reactive expense logging into a proactive financial assistant through **on-device SMS parsing**, **accelerometer-triggered shake-to-log**, **real-time anomaly detection**, and **zero-latency offline caching**.

---

## 🚀 Key Product Features

### 1. 📊 Real-Time Financial Dashboard & Net Worth
- **Comprehensive Wealth Overview**: Real-time aggregated net worth across liquid bank accounts, cash reserves, credit cards, and investments.
- **Monthly Cash Flow**: Live income vs. expense tracking with month-over-month delta indicators.
- **Category Spend Distribution**: Visual distribution breakdown identifying major spending drains instantly.

### 2. 📩 Automated Bank SMS Transaction Ingestion
- **Native Android SMS Listener**: Detects incoming debit/credit transaction SMS messages from major banks (HDFC, SBI, ICICI, Axis, Kotak, PNB, Paytm, and more).
- **Intelligent Parser Engine**: Extracts transaction amount, type (Debit/Credit), merchant/beneficiary name, and account reference numbers automatically.
- **Review & Approval Flow**: Streamlined modal overlay allowing users to confirm, categorize, and link extracted transactions to existing accounts with a single tap.

### 3. 📳 Shake-to-Log (Hardware Gesture Capture)
- **Zero-Friction Entry**: Shake your physical device anywhere in the app to instantly trigger the **Quick Expense Modal**.
- **Configurable Sensitivity & Cool-downs**: Customizable threshold parameters preventing accidental triggers.
- **Haptic Feedback**: High-precision haptic pulses confirming gesture recognition and submission.

### 4. 🔔 Proactive Intelligence & Notification Engine
- **Unusual Spending Anomaly Detection**: Flags transactions exceeding 2.5x the historical category moving average.
- **Budget Threshold Alerts**: Proactive notifications when category spending crosses 80% and 100% of defined budget caps.
- **Recurring Bill & Subscription Reminders**: Automated scheduling for upcoming payment dates with one-tap "Mark as Paid" action.
- **Intelligent Deduplication**: Suppresses redundant alert dispatches within configured cooldown windows.

### 5. ⚡ Zero-Latency Offline-First Architecture
- **7-Day Persistent Cache**: Powered by **TanStack Query** + **AsyncStorage Persister** for instant cold boots without network delays.
- **Optimistic UI Updates**: All financial mutations (adding expenses, transferring funds, editing budgets) apply immediately on the UI and synchronize in the background.
- **Postgres Real-time Subscriptions**: Automatic data synchronization across multiple devices whenever network connectivity is active.

### 6. 🔒 Biometric Security & App Lock
- **Multi-Factor Protection**: 4-digit master PIN lock combined with native **Biometrics (Face ID / Fingerprint)** via `expo-local-authentication`.
- **Encrypted Credential Storage**: Uses `expo-secure-store` for cryptographic key and PIN hash persistence.
- **Deep-Link Privacy Gate**: Holds pending notification routes securely in memory until authentication is verified.

### 7. 📑 Advanced Financial Modules
- **Subscriptions Manager**: Track recurring software, streaming, and utility subscriptions with renewal cycles and cost projections.
- **Bills Management**: Organize utility and invoice payments with due date countdowns and payment status badges.
- **Savings Goals**: Multi-milestone target tracker with progress rings and remaining contribution calculations.
- **Lends & Debts Tracker**: Monitor money lent to or borrowed from contacts with settlement history.
- **Financial Reports & Export**: Deep financial breakdowns and exportable monthly summaries.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Expo SDK 57](https://expo.dev) / React Native 0.86 | Native mobile cross-platform runtime |
| **Routing** | [Expo Router v57](https://docs.expo.dev/router/introduction/) | File-system-based typed routing & stack navigation |
| **State & Cache** | [TanStack React Query v5](https://tanstack.com/query) | Server state management, optimistic UI & offline persistence |
| **Backend & DB** | [Supabase](https://supabase.com) (PostgreSQL) | Authentication, Database, Row Level Security (RLS) & Realtime |
| **Styling** | [NativeWind v4](https://www.nativewind.dev) / Tailwind CSS | Performant, declarative design system |
| **Icons & UI** | [Lucide React Native](https://lucide.dev) | Crisp, modern minimalist iconography |
| **Sensors & Hardware**| `expo-sensors`, `expo-haptics`, `expo-local-authentication` | Accelerometer shake gestures, haptics, biometrics |
| **Notifications** | `expo-notifications`, `@react-native-firebase/messaging` | Local scheduled triggers and cloud push messaging |
| **Quality & Tests** | [Jest](https://jestjs.io), TypeScript | Unit & integration test suites, static type safety |

---

## 📐 Architecture & Financial Precision

### Integer-Based Currency Arithmetic (Minor Units)
To prevent floating-point precision rounding errors standard in JavaScript (e.g., `0.1 + 0.2 !== 0.3`), all financial figures throughout PocketWise are calculated, stored, and persisted in **minor currency units (cents/paise)**:
- `$124.50` is stored as integer `12450`.
- All database aggregations and analytics use exact integer math.
- Formatting helper functions (`formatMoney`, `parseMoneyToMinor`) handle seamless display conversion.

---

## 📁 Project Structure

```
PocketWise/
├── app/                          # Expo Router file-system routes
│   ├── (auth)/                   # Authentication flows
│   │   ├── _layout.tsx           # Auth stack navigator
│   │   ├── login.tsx             # Sleek sign-in screen
│   │   └── register.tsx          # Account creation screen
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── _layout.tsx           # Custom floating bottom tab bar
│   │   ├── index.tsx             # Core Dashboard & net worth
│   │   ├── transactions.tsx      # Transaction feed & filtering
│   │   ├── subscriptions.tsx     # Recurring subscriptions tracker
│   │   ├── budgets.tsx           # Category budget limits & progress
│   │   └── more.tsx              # Settings & financial hubs
│   ├── _layout.tsx               # Root application layout & global providers
│   ├── bills.tsx                 # Bills & invoice management
│   ├── goals.tsx                 # Savings goals tracker
│   ├── lends.tsx                 # Debt & lending ledger
│   ├── reports.tsx               # Analytics & financial reports
│   ├── shake-settings.tsx        # Shake gesture configuration
│   └── notification-settings.tsx # Notification preferences
├── components/                   # Reusable UI component library
│   ├── ui/                       # Design system (Button, Card, Input, AppModal, Badge)
│   ├── AppLockGate.tsx           # PIN & biometric security gate
│   ├── CustomBottomTabBar.tsx    # Floating tab navigation bar
│   ├── QuickExpenseModal.tsx     # Streamlined expense logger
│   └── SmsTransactionReviewModal.tsx # Ingested SMS confirmation dialog
├── lib/                          # Core domain logic & services
│   ├── finance/                  # Financial math, core types, analytics engine
│   ├── notifications/            # Push, local scheduler & deep-link service
│   ├── security/                 # Biometric & PIN lock service
│   ├── services/                 # Supabase CRUD services (accounts, transactions, etc.)
│   ├── shake/                    # Accelerometer gesture service
│   ├── sms/                      # Native SMS parser & listener
│   └── supabase.ts               # Supabase client configuration
├── __tests__/                    # Comprehensive test suite (54+ unit & integration tests)
├── assets/                       # App icons, splash screens, and images
├── global.css                    # Tailwind CSS definitions
├── tailwind.config.js            # Design tokens & color palette
└── package.json                  # Dependencies & build scripts
```

---

## 🚦 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm** or **yarn** / **bun**
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio / Xcode** (for native emulator/device testing) or **Expo Go**

### 1. Clone the Repository
```bash
git clone https://github.com/PannagaJA/PocketWise.git
cd PocketWise
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables Setup
Create a `.env` file in the root directory:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Start Development Server
```bash
# Start Metro bundler with cache reset
npx expo start -c

# Run on Android emulator / connected device
npm run android

# Run on iOS simulator
npm run ios

# Run on Web browser
npm run web
```

---

## 🧪 Testing & Quality Assurance

PocketWise maintains strict test coverage across all financial calculation engines, notification deduplication algorithms, SMS regex parsing, and security services:

```bash
# Run complete test suite
npm test

# Run TypeScript static analysis
npx tsc --noEmit
```

### Test Suite Summary:
- **Finance Engine (`__tests__/finance.test.ts`)**: Minor unit conversion, balance calculations, net worth aggregates.
- **SMS Parser (`__tests__/smsParser.test.ts`)**: Verification against 20+ major bank SMS message formats.
- **Notification Engine (`__tests__/notifications.test.ts`)**: Anomaly detection thresholds (2.5x), budget limits, deduplication cooldowns.
- **Shake Gesture (`__tests__/shakeService.test.ts`)**: Acceleration threshold calculations and cooldown timers.
- **Security & App Lock (`__tests__/stage5_security.test.ts`)**: PIN hashing, verification, biometric fallbacks.
- **Financial Reports & Modules (`__tests__/stage6_reports.test.ts`, `stage4_modules.test.ts`)**: Cash flow projections, savings rate algorithms.

---

## 🔐 Privacy & Security

- **Row Level Security (RLS)**: Database tables enforce strict Postgres RLS policies ensuring users can only read and mutate their own financial data.
- **On-Device Biometrics**: Biometric tokens and cryptographic keys are managed securely in hardware enclaves via `expo-secure-store` and `expo-local-authentication`.
- **Encrypted Transmission**: All communication between client devices and Supabase is encrypted via HTTPS/TLS 1.3.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Crafted with precision for modern personal wealth management.
</p>
