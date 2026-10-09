# PocketWise — Automated Personal Finance & Subscription Tracker

## Project Overview
PocketWise is a mobile-first personal finance application built with React Native (Expo SDK 57), Supabase, NativeWind, and native Android plugins. It bridges automated expense tracking (SMS parsing and Shake-to-Log) with subscription management, bill reminders, category budgets, savings goals, and offline caching.

## Key Objectives
- **Automated Tracking:** Seamless SMS transaction detection for Indian banks & instant Shake-to-Log expense entry.
- **Reliable Push Notifications:** Cross-platform reminder delivery for upcoming bills, subscription renewals, and budget alerts even when the app is closed.
- **Data Integrity & Security:** Database-level atomic balance calculations, biometric/PIN app lock, and Supabase Row Level Security.
- **Offline-Resilient UX:** Persistent TanStack Query cache with background mutation queue.
