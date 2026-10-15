import {
  shouldDismissSplash,
  calculateProgressRatio,
  DEFAULT_SPLASH_CONFIG,
} from '../lib/splash/splashState';

describe('Stage 6 — Splash Animation & Timing Orchestration Tests', () => {
  test('does not dismiss before minimum entrance duration (2200ms) even if auth resolves instantly', () => {
    // Auth resolved in 100ms (instant cache hit)
    const canDismiss = shouldDismissSplash(true, 100, DEFAULT_SPLASH_CONFIG);
    expect(canDismiss).toBe(false);
  });

  test('does not dismiss if 1500ms elapsed (less than 2200ms min)', () => {
    const canDismiss = shouldDismissSplash(true, 1500, DEFAULT_SPLASH_CONFIG);
    expect(canDismiss).toBe(false);
  });

  test('does not dismiss if minimum duration elapsed but auth is still loading', () => {
    // Elapsed 2500ms (>2200ms min), but auth is still fetching
    const canDismiss = shouldDismissSplash(false, 2500, DEFAULT_SPLASH_CONFIG);
    expect(canDismiss).toBe(false);
  });

  test('dismisses smoothly when both auth is ready and min entrance time has passed', () => {
    // Elapsed 2300ms (>2200ms) and auth is ready
    const canDismiss = shouldDismissSplash(true, 2300, DEFAULT_SPLASH_CONFIG);
    expect(canDismiss).toBe(true);
  });

  test('gracefully dismisses on maximum timeout (5000ms) to prevent app hang on dead network', () => {
    // Network hung for 5000ms
    const canDismiss = shouldDismissSplash(false, 5500, DEFAULT_SPLASH_CONFIG);
    expect(canDismiss).toBe(true);
  });

  test('calculates progressive loading fill smoothly without sudden jumps', () => {
    // Initial boot (0ms)
    expect(calculateProgressRatio(false, 0, DEFAULT_SPLASH_CONFIG)).toBe(0.1);

    // Halfway through entrance (1100ms)
    const midProgress = calculateProgressRatio(false, 1100, DEFAULT_SPLASH_CONFIG);
    expect(midProgress).toBeGreaterThanOrEqual(0.3);
    expect(midProgress).toBeLessThanOrEqual(0.95);

    // Full ready after entrance
    expect(calculateProgressRatio(true, 2300, DEFAULT_SPLASH_CONFIG)).toBe(1.0);
  });
});
