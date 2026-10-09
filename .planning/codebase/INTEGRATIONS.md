# External Integrations & Cloud Services

## 1. Supabase (Backend as a Service)
- **Authentication:** Supabase Auth (Email / Password).
- **PostgreSQL Database:** 11 core tables (`profiles`, `accounts`, `categories`, `transactions`, `subscriptions`, `bills`, `budgets`, `goals`, `reminders`, `devices`, `lends`).
- **Row Level Security (RLS):** Strict user isolation (`auth.uid() = user_id`).
- **Supabase Realtime:** Client subscribes to Postgres changes on `public` schema for live sync.
- **Edge Functions:** `process-reminders` (Deno) for batch processing pending reminders.

## 2. Firebase Cloud Messaging (FCM)
- **Token Registration:** `@react-native-firebase/messaging` captures device FCM push tokens on native builds and stores them in `public.devices`.
- **Push Delivery:** Edge Function queries active device tokens and dispatches push alerts via FCM HTTP v1 API with Google OAuth2 service account authentication when scheduled reminders trigger.
- **Status:** Upgraded to modern FCM HTTP v1 OAuth2 API with dead-token deactivation and error inspection.

## 3. Expo & React Native Native Modules
- **`expo-local-authentication`:** Hardware biometric fingerprint / Face ID prompts.
- **`expo-secure-store`:** Hardware keystore / keychain storage for security PIN hashes.
- **`expo-notifications`:** Local scheduled notifications and Android Notification Channel management.
- **`expo-haptics`:** Tactile vibration feedback across buttons, swipes, and modals.

## 4. Android Operating System Integrations
- **Telephony SMS BroadcastReceiver (`android.provider.Telephony.SMS_RECEIVED`):** Intercepts inbound bank SMS for automated parsing.
- **NotificationListenerService (`android.service.notification.NotificationListenerService`):** Fallback reader for Google Messages notification popups on Android 13+.
- **Accelerometer Sensor (`android.hardware.Sensor.TYPE_ACCELEROMETER`):** Foreground & background shake detection.
- **System Alert Window (`android.permission.SYSTEM_ALERT_WINDOW`):** Optional floating shake-to-log popup over other apps.
