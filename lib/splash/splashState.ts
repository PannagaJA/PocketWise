/**
 * Splash Animation & Startup Orchestration State Helper
 * Ensures smooth, truthful loading without fake arbitrary delays,
 * while guaranteeing the minimum brand entrance duration.
 */

export interface SplashTimingConfig {
  minEntranceDurationMs: number;
  maxWaitTimeoutMs: number;
}

export const DEFAULT_SPLASH_CONFIG: SplashTimingConfig = {
  minEntranceDurationMs: 2200, // Deliberate duration for banknote spring, rays, wordmark, tagline, and progress bar to be fully enjoyed
  maxWaitTimeoutMs: 5000,      // Graceful fallback if network is severely delayed
};

export function shouldDismissSplash(
  isAuthLoaded: boolean,
  elapsedMs: number,
  config: SplashTimingConfig = DEFAULT_SPLASH_CONFIG
): boolean {
  // If timeout exceeded, always dismiss gracefully so user is never blocked
  if (elapsedMs >= config.maxWaitTimeoutMs) {
    return true;
  }

  // Only dismiss when auth is genuinely ready AND minimum entrance animation has completed
  return isAuthLoaded && elapsedMs >= config.minEntranceDurationMs;
}

export function calculateProgressRatio(
  isAuthLoaded: boolean,
  elapsedMs: number,
  config: SplashTimingConfig = DEFAULT_SPLASH_CONFIG
): number {
  if (isAuthLoaded && elapsedMs >= config.minEntranceDurationMs) {
    return 1.0;
  }

  // Smoothly approach 100% during entrance sequence
  const approachProgress = Math.min(0.95, (elapsedMs / config.minEntranceDurationMs) * 0.95);
  return Math.max(0.1, approachProgress);
}
