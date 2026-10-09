# Technology Stack

## Core Technologies
- **Mobile Framework:** React Native 0.86.3 via Expo SDK ~57.0.27
- **Language & Runtime:** TypeScript ~6.0.3, React 19.2.3
- **Navigation & Routing:** Expo Router ~57.0.25 (File-based routing with custom gesture-based swipeable tab layouts)
- **UI & Styling:** NativeWind v4.2.6 (TailwindCSS v3.4.19), React Native SVG 15.15.4, Lucide React Native 1.31.0
- **Animations & Gestures:** React Native Reanimated 4.5.1, React Native Gesture Handler ~2.32.0, React Native Worklets 0.10.1

## Data & State Management
- **Backend & Database:** Supabase PostgreSQL with Row Level Security (RLS) & Realtime Websockets
- **Auth:** Supabase Auth (JWT session management)
- **Server Cache & Sync:** TanStack React Query v5.101.4 with `@tanstack/react-query-persist-client` & `@tanstack/query-async-storage-persister`
- **Local Client State:** Zustand v5.0.14 (`useAppStore`, `useTabStore`, `useModalStore`)
- **Local Storage:** `@react-native-async-storage/async-storage` 2.2.0, `expo-secure-store` ~57.0.4

## Native Device Capabilities & Plugins
- **Push & Local Notifications:** `expo-notifications` ~57.0.22, `@react-native-firebase/app` ^26.1.0, `@react-native-firebase/messaging` ^26.1.0
- **Biometrics & Security:** `expo-local-authentication` ~57.0.3, `expo-secure-store`
- **Native Android SMS Listener:** Custom Expo Config Plugin (`plugins/withAndroidSmsReceiver.js`)
- **Native Android Shake Detector:** Custom Expo Config Plugin (`plugins/withAndroidShakeDetector.js`)
- **Haptics:** `expo-haptics` ~57.0.3
