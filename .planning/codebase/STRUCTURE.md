# Directory & Module Structure

```
PocketWise/
├── app/                              # Expo Router file-based route definitions
│   ├── (auth)/                       # Authentication routes (login, register)
│   ├── (tabs)/                       # Main bottom-tab screens
│   │   ├── _layout.tsx               # Gesture swipeable bottom tab navigator
│   │   ├── index.tsx                 # Dashboard & Quick Stats overview
│   │   ├── transactions.tsx          # Transaction ledger & search/filter UI
│   │   ├── subscriptions.tsx         # Recurring subscription tracker
│   │   ├── budgets.tsx               # Category budget limits & threshold alerts
│   │   └── more.tsx                  # More navigation hub & profile access
│   ├── _layout.tsx                   # App Root Layout (Providers, LockGate, Realtime)
│   ├── bills.tsx                     # Upcoming & Paid bills screen
│   ├── goals.tsx                     # Savings goals tracker
│   ├── lends.tsx                     # HandCoins / Lends & Borrows management
│   ├── reports.tsx                   # Financial analytics & charts
│   ├── shake-settings.tsx            # Shake-to-Log sensitivity & background settings
│   ├── sms-settings.tsx              # SMS auto-tracking permissions & test simulator
│   └── notification-settings.tsx     # Push notification category & quiet hours toggles
├── components/                       # Shared reusable UI & Modal components
│   ├── ui/                           # Primitive components (Button, Card, Input, Badge, DatePickerModal)
│   ├── AppLockGate.tsx               # Biometric & PIN lock barrier
│   ├── CustomBottomTabBar.tsx        # Styled tab bar with quick-add trigger
│   ├── NetBalanceChartCard.tsx       # SVG balance trend line chart
│   ├── QuickExpenseModal.tsx         # Fast shake-to-log expense overlay
│   ├── RecordTransactionModal.tsx    # Multi-tab Income/Expense/Transfer modal
│   ├── SmsOnboardingCard.tsx         # SMS tracking permission explanation modal
│   └── SmsTransactionReviewModal.tsx # Discovered SMS transaction review & approve dialog
├── context/                          # React context providers
│   └── AuthContext.tsx               # Supabase session lifecycle & user auth provider
├── lib/                              # Core business logic, services, & utilities
│   ├── finance/                      # Financial calculation & analytics engines
│   ├── notifications/                # Notification engine, deep linking, & local/push triggers
│   ├── security/                     # Secure storage & PIN lock service
│   ├── services/                     # Supabase CRUD services (transaction, account, budget, bill, goal, lend)
│   ├── shake/                        # Shake detection bridge & storage
│   ├── sms/                          # SMS regex parsers, bank patterns, & duplicate detection
│   ├── stores/                       # Lightweight UI Zustand stores (tabs, modals)
│   ├── supabase.ts                   # Supabase client initialization
│   └── formatters.ts                 # Date and currency string utilities
├── plugins/                          # Expo config plugins for native Android injection
│   ├── withAndroidShakeDetector.js   # Native shake detector background service & floating window
│   └── withAndroidSmsReceiver.js     # Native SMS broadcast receiver & notification listener
├── store/                            # Global application Zustand store
│   └── useAppStore.ts                # General app settings & UI states
├── supabase/                         # Supabase backend definitions & migrations
│   ├── functions/process-reminders/  # Deno Edge Function for FCM reminder dispatch
│   ├── supabase_schema.sql           # Database tables, indexes, & RLS policies
│   └── supabase_seed.sql             # Default categories & initial seeds
└── __tests__/                        # Jest unit & integration test suites
```
