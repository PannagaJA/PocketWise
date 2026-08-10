# Personal Finance & Subscription Tracker

## Final Stage-Wise Implementation Plan

**Project:** Personal Finance & Subscription Tracker\
**Target:** One personal user, mobile-first\
**Platform:** Native mobile application\
**Connectivity:** Internet required for cloud data and push reminders\
**Offline-first:** No\
**Database:** Supabase PostgreSQL\
**Authentication:** Supabase Auth\
**Push notifications:** Firebase Cloud Messaging (FCM)\
**Backend logic:** Supabase Edge Functions / scheduled backend jobs\
**Local device storage:** Small local cache only; Supabase remains the
source of truth\
**Primary goal:** Simple personal finance management with reliable phone
notifications even when the app is completely closed.

------------------------------------------------------------------------

# 1. Final Product Vision

Build a personal finance application that allows one person to manage:

-   Accounts
-   Income
-   Expenses
-   Transfers
-   Categories
-   Subscriptions
-   Bills
-   Budgets
-   Savings goals
-   Financial reports
-   Recurring reminders
-   Push notifications
-   App security
-   Backup through cloud database

The application should feel like a simple personal mobile finance app,
not an accounting system or SaaS dashboard.

The most important experience is:

``` text
Open app
    ↓
Immediately see financial status
    ↓
Quickly add income/expense
    ↓
Track upcoming subscriptions/bills
    ↓
Receive phone notifications automatically
```

A reminder must be able to reach the phone when:

``` text
App is open       ✅
App is background ✅
App is closed     ✅
Phone is locked   ✅
```

provided that:

-   The device has internet connectivity.
-   Notification permission is granted.
-   The operating system allows delivery.
-   Firebase/FCM and the notification configuration are functioning.

Exact millisecond delivery cannot be guaranteed because Android/iOS and
network conditions can affect push delivery timing. The system should
target delivery at the configured reminder time.

------------------------------------------------------------------------

# 2. Final Technology Stack

  -----------------------------------------------------------------------
  Area                                Technology
  ----------------------------------- -----------------------------------
  Mobile app                          React Native + Expo

  Language                            TypeScript

  UI                                  React Native + NativeWind or a
                                      consistent custom design system

  Navigation                          Expo Router

  Forms                               React Hook Form

  Validation                          Zod

  State                               Zustand

  Database                            Supabase PostgreSQL

  Authentication                      Supabase Auth

  Backend                             Supabase Edge Functions

  Scheduled jobs                      Supabase-supported scheduled
                                      invocation / cron mechanism

  Push notifications                  Firebase Cloud Messaging

  Android notification layer          FCM + Android notification channels

  iOS notification layer              FCM/APNs integration

  Secure local credentials            Expo SecureStore / platform secure
                                      storage

  Biometrics                          Expo LocalAuthentication

  Charts                              React Native chart library

  Date handling                       date-fns

  Icons                               Lucide / Expo-compatible icon
                                      library

  Cloud file storage                  Supabase Storage if attachments are
                                      added

  Testing                             Jest + React Native Testing
                                      Library + E2E tooling
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 3. Final Architecture

``` text
                         📱 MOBILE APP
                              |
                    React Native + Expo
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
         Supabase Auth    Supabase API     FCM Token
             |                |                |
             |                v                |
             |         PostgreSQL Database      |
             |                |                |
             |                |                |
             +----------------+----------------+
                              |
                              v
                     Reminder Scheduler
                              |
                     Supabase Edge Function
                              |
                              v
                      Firebase Cloud Messaging
                              |
                              v
                       Android / iOS OS
                              |
                              v
                         🔔 Notification
```

## Source of truth

Supabase PostgreSQL is the authoritative source of financial data.

The mobile application may maintain a small local cache for:

-   Session state
-   UI preferences
-   Recent data
-   Notification/device metadata
-   Temporary form state

The financial source of truth remains the cloud database.

------------------------------------------------------------------------

# 4. Core Architectural Principles

1.  Single-user product.
2.  Mobile-first.
3.  Internet is required for normal data synchronization.
4.  Supabase is the source of truth.
5.  FCM is responsible for push delivery.
6.  The backend scheduler is responsible for determining when reminders
    should be sent.
7.  The mobile application never needs to be open for a push
    notification to arrive.
8.  Notification scheduling must not depend on the mobile app process
    remaining alive.
9.  Every reminder must have a unique ID.
10. Every sent notification must be idempotent to prevent duplicates.
11. Financial calculations belong in domain services, not UI components.
12. Do not store bank passwords, UPI PINs, card PINs, or banking
    credentials.
13. Keep the user experience simple.
14. Avoid multi-tenant SaaS complexity.
15. Build the reminder engine as a first-class system, not as an
    afterthought.

------------------------------------------------------------------------

# 5. Main Application Structure

Primary mobile navigation:

``` text
Dashboard
Transactions
Subscriptions
Budgets
Goals
More
```

Inside **More**:

``` text
Accounts
Bills
Reports
Settings
Notifications
Security
```

The bottom navigation should contain approximately five primary
destinations.

------------------------------------------------------------------------

# 6. Database Design

## 6.1 profiles

``` text
profiles
--------
id
display_name
currency
timezone
created_at
updated_at
```

The `id` should correspond to the authenticated Supabase user.

------------------------------------------------------------------------

## 6.2 accounts

``` text
accounts
--------
id
user_id
name
type
balance
currency
icon
color
is_archived
created_at
updated_at
```

Types:

``` text
cash
bank
credit_card
wallet
investment
other
```

Example:

``` text
HDFC Savings
Bank
₹45,000
```

Do not collect banking credentials.

------------------------------------------------------------------------

# 7. Categories

``` text
categories
----------
id
user_id
name
type
icon
color
is_default
created_at
updated_at
```

Types:

``` text
income
expense
```

Default expense categories:

``` text
Food
Groceries
Transport
Shopping
Entertainment
Bills
Rent
Health
Education
Travel
Subscriptions
Utilities
Personal
Other
```

Default income categories:

``` text
Salary
Freelance
Business
Investment
Gift
Other
```

Allow custom categories.

------------------------------------------------------------------------

# 8. Transactions

``` text
transactions
------------
id
user_id
account_id
type
amount_minor
currency
category_id
description
date
notes
transfer_group_id
recurring_id
created_at
updated_at
deleted_at
```

Types:

``` text
income
expense
transfer
```

## Money representation

Store money in the smallest currency unit where appropriate.

For INR:

``` text
₹450.50
```

should be stored as:

``` text
45050 paise
```

This avoids common floating-point problems.

------------------------------------------------------------------------

# 9. Subscriptions

``` text
subscriptions
-------------
id
user_id
name
amount_minor
currency
billing_cycle
next_billing_date
category_id
account_id
status
notes
created_at
updated_at
deleted_at
```

Billing cycles:

``` text
weekly
monthly
quarterly
half_yearly
yearly
custom
```

Statuses:

``` text
active
paused
cancelled
```

------------------------------------------------------------------------

# 10. Bills

``` text
bills
-----
id
user_id
name
expected_amount_minor
due_date
frequency
category_id
account_id
is_paid
paid_at
notes
created_at
updated_at
deleted_at
```

Bills and subscriptions remain separate.

Example:

``` text
Subscription:
Netflix ₹649/month

Bill:
Electricity expected ₹1,500
```

------------------------------------------------------------------------

# 11. Budgets

``` text
budgets
-------
id
user_id
category_id
amount_minor
period
start_date
end_date
created_at
updated_at
```

Example:

``` text
Food
₹8,000
August 2026
```

Recommended thresholds:

``` text
< 80%       Normal
80–99%      Warning
>= 100%     Exceeded
```

Budgets should never prevent a transaction from being recorded.

------------------------------------------------------------------------

# 12. Savings Goals

``` text
goals
-----
id
user_id
name
target_amount_minor
current_amount_minor
target_date
icon
color
notes
created_at
updated_at
```

Example:

``` text
Laptop
Target: ₹80,000
Saved: ₹35,000
```

------------------------------------------------------------------------

# 13. Notifications / Reminders

This is a core feature.

Create a dedicated reminder model:

``` text
reminders
---------
id
user_id
type
reference_id
title
body
scheduled_at
timezone
status
sent_at
attempt_count
last_error
created_at
updated_at
```

Types:

``` text
subscription
bill
budget
goal
custom
```

Statuses:

``` text
pending
processing
sent
cancelled
failed
```

Each reminder must have a unique ID.

------------------------------------------------------------------------

# 14. Device / FCM Token Table

Create:

``` text
devices
-------
id
user_id
fcm_token
platform
device_name
is_active
last_seen_at
created_at
updated_at
```

Platform:

``` text
android
ios
```

Because the application is intended for one person, this remains simple,
but the model should still support more than one device if needed later.

------------------------------------------------------------------------

# 15. Stage 0 --- Product Scope

## Objective

Freeze the final requirements.

### Tasks

-   [ ] Confirm single-user scope
-   [ ] Confirm mobile-only scope
-   [ ] Confirm internet-required architecture
-   [ ] Confirm Supabase
-   [ ] Confirm FCM
-   [ ] Confirm push notifications while app is closed
-   [ ] Confirm reminder types
-   [ ] Confirm INR/default currency
-   [ ] Confirm authentication method
-   [ ] Confirm biometric requirement
-   [ ] Confirm no bank integrations
-   [ ] Confirm no SaaS billing

### Completion criteria

The architecture and product scope are frozen.

------------------------------------------------------------------------

# 16. Stage 1 --- Project Foundation

## Objective

Create the mobile application foundation.

### Tasks

-   [ ] Create Expo React Native project
-   [ ] Configure TypeScript
-   [ ] Configure Expo Router
-   [ ] Configure styling/design system
-   [ ] Configure ESLint
-   [ ] Configure formatting
-   [ ] Add Zustand
-   [ ] Add React Hook Form
-   [ ] Add Zod
-   [ ] Add date-fns
-   [ ] Add icons
-   [ ] Configure environment variables
-   [ ] Create development/production configurations
-   [ ] Create app theme
-   [ ] Create reusable components

### Basic routes

``` text
/onboarding
/login
/dashboard
/transactions
/subscriptions
/budgets
/goals
/accounts
/bills
/reports
/settings
/notifications
/security
```

### Completion criteria

The application builds and launches on the target mobile platform.

------------------------------------------------------------------------

# 17. Stage 2 --- Supabase Setup

## Objective

Create the cloud backend.

### Tasks

-   [ ] Create Supabase project
-   [ ] Configure database
-   [ ] Configure authentication
-   [ ] Configure development environment
-   [ ] Configure production environment
-   [ ] Create migrations
-   [ ] Create database tables
-   [ ] Create indexes
-   [ ] Configure Row Level Security
-   [ ] Create RLS policies
-   [ ] Test user isolation
-   [ ] Create database seed data

### Security requirement

Every user-owned table must be protected using RLS.

A user must only be able to access records belonging to their
authenticated user ID.

### Completion criteria

Authenticated users can safely access only their own financial data.

------------------------------------------------------------------------

# 18. Stage 3 --- Authentication & Onboarding

## Objective

Create a simple but secure login flow.

## Authentication

Possible options:

``` text
Email + Password
Email OTP
Google Sign-In
```

Choose one primary method instead of presenting unnecessary choices.

## Onboarding

``` text
Welcome
   ↓
Sign in
   ↓
Create profile
   ↓
Create first account
   ↓
Enter current balance
   ↓
Optional monthly income
   ↓
Dashboard
```

Do not require:

-   Bank account number
-   IFSC
-   Card number
-   UPI PIN
-   Banking password

### Completion criteria

A new user can reach the dashboard with minimal setup.

------------------------------------------------------------------------

# 19. Stage 4 --- Local Security

## Objective

Protect the application on the device.

### Features

-   [ ] App PIN
-   [ ] PIN confirmation
-   [ ] Secure PIN-related secrets
-   [ ] Biometric authentication
-   [ ] App lock timeout
-   [ ] Lock when returning from background
-   [ ] Change PIN
-   [ ] Disable biometric authentication
-   [ ] Failed-attempt handling

Use the mobile OS/platform authentication APIs for biometric
verification.

Do not implement custom fingerprint handling.

### Completion criteria

The user can secure the app using a PIN and supported device biometrics.

------------------------------------------------------------------------

# 20. Stage 5 --- Accounts

## Features

-   [ ] Create account
-   [ ] Edit account
-   [ ] Archive account
-   [ ] Restore account
-   [ ] View balance
-   [ ] View account transactions
-   [ ] Credit card support
-   [ ] Cash support
-   [ ] Multiple account support

Example:

``` text
Accounts

Total Balance
₹62,450

HDFC Savings
₹45,000

Cash
₹5,000

Credit Card
-₹12,450

+ Add Account
```

### Completion criteria

Account balances accurately reflect transactions.

------------------------------------------------------------------------

# 21. Stage 6 --- Transaction Engine

## Objective

Make recording an expense extremely fast.

### Add transaction

``` text
[ Expense ] [ Income ] [ Transfer ]

Amount
₹ ______

Category
Food

Account
HDFC Savings

Date
Today

Description
Dinner

[ Save ]
```

### Features

-   [ ] Add
-   [ ] Edit
-   [ ] Delete
-   [ ] Search
-   [ ] Filter
-   [ ] Date filtering
-   [ ] Category filtering
-   [ ] Account filtering
-   [ ] Income
-   [ ] Expense
-   [ ] Transfer
-   [ ] Notes
-   [ ] Transaction details

### Balance rules

Expense:

``` text
balance = balance - expense
```

Income:

``` text
balance = balance + income
```

Transfer:

``` text
source = source - amount
destination = destination + amount
```

Transfers do not count as income or expense.

### Completion criteria

A user can add a transaction in a few seconds and the financial totals
remain correct.

------------------------------------------------------------------------

# 22. Stage 7 --- Subscription Tracker

## Features

-   [ ] Create subscription
-   [ ] Edit subscription
-   [ ] Pause
-   [ ] Cancel
-   [ ] Reactivate
-   [ ] Billing cycle
-   [ ] Next billing date
-   [ ] Category
-   [ ] Account
-   [ ] Notes
-   [ ] Monthly cost
-   [ ] Annual cost
-   [ ] Upcoming payment

Example:

``` text
Netflix
₹649/month

Next payment
15 Aug

Monthly total
₹2,847

Annual total
₹34,164
```

### Completion criteria

All active subscriptions contribute correctly to projected monthly and
annual cost.

------------------------------------------------------------------------

# 23. Stage 8 --- Bills

## Features

-   [ ] Add bill
-   [ ] Edit bill
-   [ ] Delete bill
-   [ ] Mark paid
-   [ ] Mark unpaid
-   [ ] Due date
-   [ ] Expected amount
-   [ ] Actual amount
-   [ ] Recurrence
-   [ ] Account
-   [ ] Category
-   [ ] Optional transaction creation

### Completion criteria

Bills can be tracked independently from subscriptions and paid bills can
optionally generate transactions.

------------------------------------------------------------------------

# 24. Stage 9 --- Budgets

## Features

-   [ ] Create budget
-   [ ] Edit budget
-   [ ] Delete budget
-   [ ] Category budget
-   [ ] Calculate actual spending
-   [ ] Remaining amount
-   [ ] Percentage used
-   [ ] Budget warning
-   [ ] Budget exceeded state

Example:

``` text
Food

₹6,200 / ₹8,000

77.5%
₹1,800 remaining
```

### Completion criteria

Budget calculations always reflect actual transaction data.

------------------------------------------------------------------------

# 25. Stage 10 --- Savings Goals

## Features

-   [ ] Create goal
-   [ ] Edit goal
-   [ ] Archive goal
-   [ ] Add contribution
-   [ ] Remove contribution
-   [ ] Progress percentage
-   [ ] Remaining amount
-   [ ] Target date
-   [ ] Completion state

Example:

``` text
Laptop

₹35,000 / ₹80,000

43.75%
```

### Completion criteria

Goal progress is accurate and easy to understand.

------------------------------------------------------------------------

# 26. Stage 11 --- Dashboard

The dashboard should answer:

> How much do I have, how much did I spend, what is coming next, and how
> am I doing?

## Dashboard

``` text
Good morning 👋

Total Balance
₹62,450

Income
₹55,000

Expenses
₹27,450

Saved
₹27,550

Upcoming

Netflix       ₹649
Electricity   ₹1,450
Rent          ₹15,000

Recent

Dinner       -₹450
Uber         -₹320
Salary      +₹50,000
```

## Charts

-   Spending by category
-   Income vs expenses
-   Monthly savings

Avoid excessive cards.

### Completion criteria

The user's financial state is understandable within a few seconds.

------------------------------------------------------------------------

# 27. Stage 12 --- Reports

## Reports

### Monthly

``` text
Income
Expenses
Savings
Savings Rate
```

### Spending

``` text
Food
Rent
Transport
Shopping
Entertainment
```

### Trends

``` text
3 months
6 months
12 months
```

### Subscription analysis

``` text
Monthly subscription cost
Annual subscription cost
Subscriptions by category
```

### Completion criteria

Reports are derived from the same domain calculations used by the
dashboard.

------------------------------------------------------------------------

# 28. Stage 13 --- Notification Infrastructure

This stage is critical.

## Objective

Connect the mobile application to FCM and register the device.

### Tasks

-   [ ] Create Firebase project
-   [ ] Configure Android app
-   [ ] Configure iOS app if required
-   [ ] Configure Firebase Cloud Messaging
-   [ ] Configure Expo/native Firebase requirements
-   [ ] Request notification permission
-   [ ] Generate FCM token
-   [ ] Send token to Supabase
-   [ ] Store device token
-   [ ] Handle token refresh
-   [ ] Deactivate stale tokens
-   [ ] Configure notification channels on Android
-   [ ] Configure iOS notification categories as needed
-   [ ] Test foreground notification
-   [ ] Test background notification
-   [ ] Test completely closed app notification
-   [ ] Test locked-screen notification

### Completion criteria

A backend-triggered FCM message can reach the phone while the
application is closed.

------------------------------------------------------------------------

# 29. Stage 14 --- Reminder Engine

## Objective

Create a reliable server-side reminder system.

The mobile app should NOT be responsible for staying alive and checking
the clock.

Instead:

``` text
Supabase
   ↓
Reminder Scheduler
   ↓
Find due reminders
   ↓
FCM
   ↓
Phone
```

## Reminder configuration

Each reminder should contain:

``` text
Type
Reference
Scheduled time
Timezone
Title
Body
Status
```

Example:

``` text
Netflix
Payment: 15 Aug
Reminder: 14 Aug
Time: 09:00
Timezone: Asia/Kolkata
```

### Reminder states

``` text
pending
processing
sent
cancelled
failed
```

### Completion criteria

The backend can determine which reminders are due independently of
whether the mobile app is open.

------------------------------------------------------------------------

# 30. Stage 15 --- Scheduled Reminder Delivery

## Objective

Trigger FCM at the configured time.

## Flow

``` text
                    Subscription
                         |
                         v
                  Reminder record
                         |
                         v
                 Scheduled backend
                         |
                  At due time
                         |
                         v
                 Validate reminder
                         |
                         v
                 Check not already sent
                         |
                         v
                    Send FCM
                         |
                         v
                  Update status
                         |
                         v
                    sent_at
```

## Idempotency

Before sending:

``` text
if status == sent:
    do not send again
```

Use unique reminder IDs and an atomic state transition where practical.

This prevents duplicate notifications if a scheduler retries.

------------------------------------------------------------------------

# 31. Stage 16 --- Subscription Reminder Automation

When creating a subscription:

``` text
Netflix
₹649
Monthly
Next billing:
15 Aug
```

Allow:

``` text
Reminder:
1 day before
09:00 AM
```

The system automatically creates the reminder.

Example:

``` text
Subscription
15 Aug, 09:00

Reminder
14 Aug, 09:00
```

When the subscription's next billing date changes, regenerate/reschedule
the next reminder.

When cancelled:

``` text
Subscription status = cancelled
```

its pending reminder should be cancelled.

------------------------------------------------------------------------

# 32. Stage 17 --- Bill Reminder Automation

Example:

``` text
Electricity
Due: 10 Aug
Expected: ₹1,450

Reminder:
1 day before
09:00 AM
```

Generate:

``` text
09 Aug
09:00 AM
```

Notification:

``` text
🔔 Electricity bill tomorrow

Expected amount: ₹1,450
```

When the bill is marked paid, any future reminder associated with that
bill instance should be cancelled.

------------------------------------------------------------------------

# 33. Stage 18 --- Budget Notifications

Example:

``` text
Food budget
₹8,000
```

When spending reaches a configured threshold:

``` text
80%
```

send:

``` text
🔔 Food budget alert

You've used 80% of your ₹8,000 budget.
```

At 100%:

``` text
🔔 Food budget exceeded

You've spent ₹8,250 of your ₹8,000 budget.
```

Avoid sending repeated alerts for the same threshold.

Store notification state so the same threshold isn't repeatedly
delivered.

------------------------------------------------------------------------

# 34. Stage 19 --- Goal Notifications

Optional initial milestone notifications:

``` text
50%
75%
90%
100%
```

Example:

``` text
🎯 Savings goal update

Your Laptop goal reached 75%.

₹60,000 / ₹80,000
```

Do not spam the user.

Each milestone should be sent at most once per goal unless reset
intentionally.

------------------------------------------------------------------------

# 35. Stage 20 --- Notification Preferences

Settings:

``` text
Notifications

Subscriptions       ON
Bills                ON
Budget alerts        ON
Goal milestones      ON

Default reminder
1 day before

Default time
09:00 AM
```

Per-subscription override:

``` text
Netflix

Reminder
1 day before

Time
09:00 AM

[ Save ]
```

Users must be able to disable individual reminders.

------------------------------------------------------------------------

# 36. Stage 21 --- Notification Deep Links

A notification should open the relevant screen.

Example:

``` text
🔔 Netflix payment tomorrow
₹649
```

Tap notification:

``` text
→ Subscription details
```

Bill:

``` text
🔔 Electricity bill tomorrow
₹1,450
```

Tap:

``` text
→ Bill details
```

Budget:

``` text
→ Budget details
```

This should be implemented using app deep links/navigation.

------------------------------------------------------------------------

# 37. Stage 22 --- Missed Notification Handling

FCM delivery depends on connectivity and OS behavior.

If the device has no internet at the exact reminder time, the backend
should not assume the user received the notification.

Implement a missed-reminder policy.

Example:

``` text
Reminder scheduled:
09:00

Device unavailable

Device returns:
11:30
```

The system can determine:

``` text
Reminder was missed
```

Then decide whether it is still relevant.

Recommended policy:

-   Send still-relevant reminders.
-   Do not send very old reminders.
-   Do not send reminders for already-paid bills.
-   Do not send cancelled subscription reminders.
-   Avoid flooding the user with many stale notifications.
-   Optionally collapse multiple missed reminders.

This policy belongs in the backend reminder service.

------------------------------------------------------------------------

# 38. Stage 23 --- App Notification UX

The notification should be short and useful.

Examples:

``` text
🔔 Netflix payment tomorrow
₹649 subscription is due tomorrow.
```

``` text
🔔 Electricity bill due tomorrow
Expected amount: ₹1,450.
```

``` text
🔔 Food budget alert
You've used 80% of your ₹8,000 budget.
```

Avoid putting sensitive information into notification text if the user
may have lock-screen privacy concerns.

Provide a notification privacy setting:

``` text
Show financial amount on lock screen
ON / OFF
```

------------------------------------------------------------------------

# 39. Stage 24 --- Security & Privacy

## Application security

-   [ ] Supabase Auth
-   [ ] Row Level Security
-   [ ] Secure token storage
-   [ ] App PIN
-   [ ] Biometrics
-   [ ] Session management
-   [ ] Logout
-   [ ] Secure environment variables
-   [ ] No secrets in client source

## Financial privacy

Never store:

``` text
Bank passwords
UPI PIN
Card PIN
Internet banking passwords
```

Do not request unnecessary sensitive financial credentials.

------------------------------------------------------------------------

# 40. Stage 25 --- Database Security

Every user-owned table should have:

``` text
user_id
```

and RLS.

Conceptually:

``` text
authenticated user
       |
       v
user_id = auth.uid()
       |
       v
access only own rows
```

Test:

``` text
User A cannot read User B's:
- accounts
- transactions
- subscriptions
- bills
- budgets
- goals
- reminders
- devices
```

------------------------------------------------------------------------

# 41. Stage 26 --- Error Handling

Handle:

-   Network unavailable
-   Supabase request failure
-   Authentication failure
-   Expired session
-   Database constraint failure
-   FCM token failure
-   Notification permission denied
-   Scheduler failure
-   Duplicate reminder
-   Invalid backup/import if implemented later
-   Invalid financial amounts

Use friendly messages.

Bad:

``` text
PostgREST error 23505
```

Good:

``` text
We couldn't save this transaction. Please try again.
```

------------------------------------------------------------------------

# 42. Stage 27 --- Loading and Empty States

Every screen needs a proper state.

## Loading

``` text
Loading your finances...
```

## Empty transactions

``` text
No transactions yet.

Add your first expense or income.

[ + Add Transaction ]
```

## Empty subscriptions

``` text
No subscriptions yet.

[ + Add Subscription ]
```

Do not leave blank screens.

------------------------------------------------------------------------

# 43. Stage 28 --- Mobile UX

The application must be designed for touch.

## Rules

-   Large touch targets
-   Bottom navigation
-   Floating add action
-   Numeric keyboard for amounts
-   Quick category buttons
-   Date picker
-   Bottom sheets where useful
-   Minimal typing
-   Avoid dense tables
-   Avoid desktop dashboards
-   Support one-handed use
-   Clear loading states
-   Clear confirmation states

------------------------------------------------------------------------

# 44. Stage 29 --- Performance

The application should remain fast with thousands of transactions.

## Rules

-   Paginate transaction history
-   Query only required records
-   Avoid fetching everything on every screen
-   Cache appropriate data
-   Memoize expensive calculations
-   Lazy-load reports
-   Avoid unnecessary global state
-   Use database indexes
-   Keep notification polling out of the mobile app

The server-side scheduler handles reminder timing.

------------------------------------------------------------------------

# 45. Stage 30 --- Testing

## Unit tests

Test:

-   Account balance
-   Income
-   Expense
-   Transfers
-   Budget percentages
-   Subscription normalization
-   Annual cost
-   Monthly cost
-   Goal percentages
-   Reminder date calculations
-   Timezone conversion
-   Reminder status transitions

## Integration tests

Test:

``` text
Authentication
→ Create account
→ Add transaction
→ Add subscription
→ Generate reminder
→ Scheduler finds reminder
→ FCM send request
→ Reminder marked sent
```

## Notification tests

Test:

-   App open
-   App background
-   App completely closed
-   Phone locked
-   Notification permission granted
-   Notification permission denied
-   Token refresh
-   Token invalidation
-   Multiple devices if later supported
-   Duplicate scheduler execution
-   Network interruption

## Security tests

Test:

-   RLS
-   Unauthorized database access
-   Session expiry
-   Token handling
-   PIN
-   Biometrics
-   Logout

------------------------------------------------------------------------

# 46. Stage 31 --- Production Notification Testing

This stage must be performed on real devices.

Do not rely only on an emulator.

## Android

Test:

``` text
App open
App background
App closed
Phone locked
Battery saver
Notification permission
Notification channel
Do Not Disturb behavior
```

## iOS

Test:

``` text
App open
App background
App terminated
Phone locked
Notification permission
Focus modes
Notification settings
```

Platform-specific behavior must be respected.

------------------------------------------------------------------------

# 47. Stage 32 --- Analytics and Logging

For a personal app, avoid invasive analytics.

Only log operational information necessary for debugging:

``` text
Reminder created
Reminder scheduled
Reminder sent
Reminder failed
FCM token refreshed
Authentication failure
```

Do not log:

``` text
Full transaction descriptions
Sensitive financial details
Passwords
Tokens
Authentication secrets
```

------------------------------------------------------------------------

# 48. Stage 33 --- Final Settings

``` text
Settings

Profile
├── Name
├── Currency
└── Timezone

Notifications
├── Subscriptions
├── Bills
├── Budgets
├── Goals
└── Default reminder time

Security
├── PIN
├── Biometrics
└── Auto Lock

Appearance
├── Light
├── Dark
└── System

Data
├── Export
├── Delete account
└── Delete all financial data

About
└── Version
```

------------------------------------------------------------------------

# 49. Stage 34 --- Backup Strategy

Because Supabase is the primary data store, cloud data acts as the
primary backup.

Still implement:

``` text
Export personal data
```

for user control.

Optional later:

``` text
CSV export
JSON export
PDF financial report
```

Do not make manual backup a blocker for MVP.

------------------------------------------------------------------------

# 50. Stage 35 --- Production Deployment

## Backend

-   [ ] Supabase production project
-   [ ] Production migrations
-   [ ] RLS verification
-   [ ] Edge Functions deployed
-   [ ] Scheduled jobs configured
-   [ ] Environment variables configured
-   [ ] FCM credentials configured securely

## Mobile

-   [ ] Production bundle identifier
-   [ ] Android package name
-   [ ] iOS bundle ID
-   [ ] App icon
-   [ ] Splash screen
-   [ ] Production Firebase configuration
-   [ ] Notification permissions
-   [ ] Release signing
-   [ ] Production builds

------------------------------------------------------------------------

# 51. Recommended Development Sequence

Implement exactly in this order:

``` text
1. Product Scope
        ↓
2. Expo Foundation
        ↓
3. Supabase
        ↓
4. Authentication
        ↓
5. Security / Biometrics
        ↓
6. Accounts
        ↓
7. Transactions
        ↓
8. Subscriptions
        ↓
9. Bills
        ↓
10. Budgets
        ↓
11. Goals
        ↓
12. Dashboard
        ↓
13. Reports
        ↓
14. FCM Infrastructure
        ↓
15. Reminder Engine
        ↓
16. Scheduled Delivery
        ↓
17. Subscription Reminders
        ↓
18. Bill Reminders
        ↓
19. Budget Alerts
        ↓
20. Goal Notifications
        ↓
21. Notification Deep Links
        ↓
22. Missed Reminder Handling
        ↓
23. Settings
        ↓
24. Error Handling
        ↓
25. Testing
        ↓
26. Production Notification Testing
        ↓
27. Production Deployment
```

------------------------------------------------------------------------

# 52. MVP Definition

The first production version must contain:

## Authentication

-   [ ] Supabase Auth
-   [ ] Secure session
-   [ ] App PIN
-   [ ] Biometrics

## Finance

-   [ ] Accounts
-   [ ] Categories
-   [ ] Income
-   [ ] Expenses
-   [ ] Transfers
-   [ ] Transactions
-   [ ] Subscriptions
-   [ ] Bills
-   [ ] Budgets
-   [ ] Savings goals

## Dashboard

-   [ ] Total balance
-   [ ] Monthly income
-   [ ] Monthly expenses
-   [ ] Savings
-   [ ] Upcoming payments
-   [ ] Recent transactions
-   [ ] Spending breakdown
-   [ ] Budget progress

## Notifications

-   [ ] FCM
-   [ ] Device token registration
-   [ ] Subscription reminders
-   [ ] Bill reminders
-   [ ] Budget alerts
-   [ ] Notification settings
-   [ ] Closed-app notification
-   [ ] Notification deep links
-   [ ] Duplicate prevention
-   [ ] Missed reminder handling

## Backend

-   [ ] Supabase PostgreSQL
-   [ ] RLS
-   [ ] Reminder table
-   [ ] Device table
-   [ ] Edge Functions
-   [ ] Scheduled reminder processing

------------------------------------------------------------------------

# 53. Version 2 Features

Do not build these before the MVP is stable:

-   Recurring transaction automation
-   Multiple currencies
-   Investment portfolio tracking
-   Net worth history
-   Advanced spending forecasts
-   Receipt scanning
-   OCR
-   CSV import
-   PDF reports
-   Custom notification rules
-   More advanced recurring bill logic
-   Multiple device support
-   Advanced cloud backup
-   AI financial insights

------------------------------------------------------------------------

# 54. Features Explicitly Out of Scope

Do not build:

-   Bank credential storage
-   UPI PIN storage
-   Card PIN storage
-   Bank scraping
-   Trading
-   Brokerage integration
-   Multi-tenant SaaS
-   Admin panel
-   Subscription billing for this app
-   Social features
-   Financial marketplace
-   Complex double-entry accounting

------------------------------------------------------------------------

# 55. Final Notification Architecture

This is the most important part of the final design.

``` text
                 📱 MOBILE APP
                       |
                       |
               Create Subscription
                       |
                       v
                Supabase Database
                       |
                       v
                Reminder Record
                       |
                       v
             Scheduled Backend Job
                       |
                 Reminder Due
                       |
                       v
             Validate / Deduplicate
                       |
                       v
                 Firebase FCM
                       |
                       v
              Android / iOS OS
                       |
                       v
                🔔 PUSH MESSAGE
                       |
                       v
                 User's Phone
```

Example:

``` text
Subscription:
Netflix
₹649/month

Next billing:
15 Aug 2026

Reminder:
14 Aug 2026
09:00 AM
Asia/Kolkata
```

At the configured reminder time:

``` text
Scheduler
   ↓
Find Netflix reminder
   ↓
Check status = pending
   ↓
Send FCM
   ↓
Mark reminder as sent
   ↓
📱 🔔 Netflix payment tomorrow
      ₹649
```

The application itself does not need to be open.

------------------------------------------------------------------------

# 56. Important Notification Reliability Rule

FCM provides push delivery, but it does not guarantee that every message
will appear at an exact millisecond.

The system should be designed around:

``` text
Target:
09:00 AM

Expected:
Near-real-time delivery

Not:
Exactly 09:00:00.000 guaranteed
```

Possible factors outside the app's control include:

-   Network conditions
-   Android/iOS power management
-   Notification permissions
-   Do Not Disturb/Focus modes
-   OS notification settings
-   Device connectivity
-   FCM delivery behavior

Therefore, the application should never claim mathematically exact
delivery.

------------------------------------------------------------------------

# 57. Final Product Architecture

``` text
                         ┌───────────────────────┐
                         │       USER            │
                         │       📱 Phone        │
                         └───────────┬───────────┘
                                     │
                                     v
                         ┌───────────────────────┐
                         │ React Native + Expo   │
                         └───────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              v                      v                      v
        Supabase Auth          Supabase API             FCM Token
              │                      │                      │
              │                      v                      │
              │              PostgreSQL DB                  │
              │                      │                      │
              │          ┌───────────┴───────────┐          │
              │          │                       │          │
              │       Finance                 Reminders     │
              │          │                       │          │
              │          │                       v          │
              │          │               Scheduled Jobs     │
              │          │                       │          │
              │          │                       v          │
              │          │                     FCM <────────┘
              │          │                       │
              │          │                       v
              │          │                📱 OS Notification
              │          │
              └──────────┴───────────────────────────────
```

------------------------------------------------------------------------

# 58. Final Definition of Done

The application is production-ready when:

## Finance

-   [ ] Account balances are correct
-   [ ] Transactions are correct
-   [ ] Transfers are correct
-   [ ] Subscriptions calculate correctly
-   [ ] Bills work correctly
-   [ ] Budgets match transaction data
-   [ ] Goals calculate correctly
-   [ ] Reports match source data

## Authentication

-   [ ] Login works
-   [ ] Logout works
-   [ ] Session handling works
-   [ ] PIN works
-   [ ] Biometrics works where supported

## Notifications

-   [ ] FCM token registration works
-   [ ] FCM delivery works
-   [ ] Notification permission flow works
-   [ ] App-open notification works
-   [ ] Background notification works
-   [ ] Completely closed-app notification works
-   [ ] Locked-phone notification works
-   [ ] Subscription reminders work
-   [ ] Bill reminders work
-   [ ] Budget alerts work
-   [ ] Goal notifications work
-   [ ] Deep links work
-   [ ] Duplicate notifications are prevented
-   [ ] Missed reminders are handled

## Backend

-   [ ] Supabase RLS is verified
-   [ ] Scheduled jobs work
-   [ ] Edge Functions work
-   [ ] FCM credentials are secure
-   [ ] Reminder processing is idempotent
-   [ ] Failed reminders can be retried

## Production

-   [ ] Android real-device testing passed
-   [ ] iOS real-device testing passed if iOS is supported
-   [ ] Production database secured
-   [ ] Production FCM configured
-   [ ] Production environment variables secured
-   [ ] App release build tested

------------------------------------------------------------------------

# 59. Final Recommendation

The final architecture for this version should be:

``` text
React Native + Expo
        +
Supabase
        +
PostgreSQL
        +
Supabase Auth
        +
Supabase Edge Functions
        +
Scheduled Backend Jobs
        +
Firebase Cloud Messaging
        +
PIN + Biometrics
```

The most important design decision is:

> **Supabase stores the financial state, the backend scheduler decides
> when a reminder is due, and FCM delivers the notification to the
> phone.**

The mobile application does not need to remain open for reminders.

This gives the application the exact experience required:

``` text
User creates reminder
        ↓
App can be completely closed
        ↓
Scheduled time arrives
        ↓
Backend detects due reminder
        ↓
FCM sends push
        ↓
📱 🔔 Notification appears
```

The implementation should be built stage-by-stage rather than as one
giant coding task. Each stage should be tested and completed before
moving to the next one.
