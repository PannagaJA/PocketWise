# Phase 3: Research — Push Notification Modernization (FCM HTTP v1)

## Current State Analysis

### 1. Legacy FCM API Deprecation
- **Location:** `supabase/functions/process-reminders/index.ts`
- **Current implementation:**
  - POST request to `https://fcm.googleapis.com/fcm/send`
  - Header: `Authorization: key=${FCM_SERVER_KEY}`
- **Problem:** Google decommissioned this legacy endpoint in June 2024. All requests to this endpoint in production will return 404/401 errors.

### 2. FCM HTTP v1 API Specifications
- **Target Endpoint:** `https://fcm.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/messages:send`
- **Authentication:** OAuth2 Bearer token with scope `https://www.googleapis.com/auth/firebase.messaging`.
- **JWT Generation in Deno:**
  - Standard service account JSON containing:
    - `client_email`
    - `private_key` (PEM format)
    - `project_id`
  - Generate RS256 JWT assertion with 1-hour expiration and exchange at `https://oauth2.googleapis.com/token` for a temporary `access_token`.
- **Payload Schema:**
  ```json
  {
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "notification": {
        "title": "Renewal Due: Netflix",
        "body": "Amount: ₹649"
      },
      "data": {
        "type": "subscription",
        "reference_id": "sub_123"
      },
      "android": {
        "priority": "HIGH",
        "notification": {
          "channel_id": "pocketwise-reminders",
          "default_sound": true
        }
      }
    }
  }
  ```

### 3. Automated Scheduling via Supabase `pg_cron`
- Supabase native PostgreSQL allows scheduling scheduled HTTP calls using `pg_cron` and `pg_net` extensions.
- Configured to invoke `/functions/v1/process-reminders` every minute to process pending reminders whose `scheduled_at <= NOW()`.
- Built-in idempotency status transitions: `pending` -> `processing` -> `sent` / `failed`.
