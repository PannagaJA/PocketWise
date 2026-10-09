# Phase 3: Context & Boundaries

## Goals
1. Modernize Supabase Edge Function reminder processor to use Google FCM HTTP v1 OAuth2 API.
2. Provide PostgreSQL `pg_cron` & `pg_net` scheduling configuration in database migrations.
3. Harden device token registration and notification preferences.

## In Scope
- Refactor `supabase/functions/process-reminders/index.ts` to implement Google Service Account OAuth2 JWT signing and FCM HTTP v1 messaging.
- Add `pg_cron` / `pg_net` scheduled invocation script in `supabase_schema.sql`.
- Polish device token upsert in `lib/notifications/notification.service.ts` to ensure multi-device active token tracking.
- Test suite verifying FCM v1 payload construction, OAuth token assertion formatting, and reminder retry policies.

## Out of Scope
- Offline outbox queue (Phase 4).
- Reports CSV/PDF export (Phase 5).
