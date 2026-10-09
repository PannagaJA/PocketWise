# Code Conventions & Patterns

## 1. Financial Numbers & Currency Handling
- **Rule:** Never store or calculate money as floating-point decimals in domain services or database.
- **Representation:** All monetary values are represented as minor units (integers, e.g. Paise for INR: `₹100.50` = `10050`).
- **Helpers:** Use `formatMoney(minorAmount)` and `parseMoneyToMinor(inputString)` from `lib/finance/core.ts`.

## 2. State & Caching Architecture
- **Server Data:** Managed exclusively via TanStack React Query (`useQuery`, `useMutation`).
- **Query Invalidation:** TanStack mutation cache globally invalidates all queries on success (`queryClient.invalidateQueries()`).
- **UI State:** Ephemeral UI toggles (active tab, active modal, dropdown states) use Zustand stores (`lib/stores/`) or local React state.

## 3. Styling & Theming
- **Tailwind Classes:** NativeWind `className="..."` syntax.
- **Color Palette:** Curated modern palette with Indigo primary (`#6366F1`), Zinc neutrals (`#18181B`, `#71717A`, `#F4F4F5`), Emerald positive (`#10B981`), and Rose negative (`#EF4444`).
- **Safe Area Insets:** All top-level screens wrap in `SafeAreaView` from `react-native-safe-area-context` with `edges={['top', 'left', 'right']}` to prevent status bar and bottom nav overlaps.

## 4. Native & Background Safety
- **Platform Guards:** Always check `Platform.OS === 'android'` before calling native Android modules (`PocketWiseSmsModule`, `PocketWiseShakeModule`).
- **Graceful Fallbacks:** In Expo Go or Web environments, native modules must safely return `false` or fallback to mock handlers without crashing.
