import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppReleaseInfo {
  version: string;
  currentVersion: string;
  name: string;
  changelog: string;
  apkUrl: string;
  apkSize?: number;
  publishedAt: string;
  htmlUrl: string;
}

const PocketWiseSmsModule = NativeModules?.PocketWiseSmsModule;
const GITHUB_REPO = 'PannagaJA/PocketWise';
const LAST_CHECK_KEY = 'pocketwise_last_update_check_ts';
const CHECK_COOLDOWN_MS = 1000 * 60 * 60 * 4; // 4 hours auto-check cooldown

/**
 * Compare two semver strings: e.g. "1.0.1" vs "1.0.0"
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').trim();
  const clean2 = v2.replace(/^v/, '').trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export class AppUpdateService {
  private cachedVersion: string | null = null;

  /**
   * Get the installed app version.
   * Priority:
   * 1. Recorded GitHub version tag from the most recent installed update (if >= native version)
   * 2. Native Android PackageManager packageInfo.versionName
   * 3. expoConfig / fallback
   */
  async getInstalledVersion(): Promise<string> {
    let installedGhVersion: string | null = null;
    try {
      installedGhVersion = await AsyncStorage.getItem('pocketwise_installed_github_version');
    } catch {}

    let nativeVersion: string | null = null;
    if (Platform.OS === 'android' && PocketWiseSmsModule?.getAppVersion) {
      try {
        const info = await PocketWiseSmsModule.getAppVersion();
        if (info?.versionName) {
          nativeVersion = info.versionName;
        }
      } catch (err) {
        console.warn('[AppUpdateService] Failed to read native package version:', err);
      }
    }

    const expoVersion = Constants?.expoConfig?.version || (Constants as any)?.default?.expoConfig?.version;
    const baseVersion = nativeVersion || expoVersion || '1.0.2';

    if (installedGhVersion && compareSemver(installedGhVersion, baseVersion) >= 0) {
      this.cachedVersion = installedGhVersion;
      return installedGhVersion;
    }

    this.cachedVersion = baseVersion;
    return baseVersion;
  }

  /**
   * Record the installed GitHub version tag so the app identifies with the GitHub release version
   */
  async recordInstalledGithubVersion(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem('pocketwise_installed_github_version', version);
      this.cachedVersion = version;
    } catch {}
  }

  /**
   * Synchronous getter for current app version
   */
  getCurrentVersion(): string {
    const expoVersion = Constants?.expoConfig?.version || (Constants as any)?.default?.expoConfig?.version;
    return this.cachedVersion || expoVersion || '1.0.2';
  }

  /**
   * Check GitHub Releases for a newer version of PocketWise
   */
  async checkForUpdate(isManual = false): Promise<AppReleaseInfo | null> {
    if (Platform.OS !== 'android') {
      return null;
    }

    // Cooldown check for automatic background checks
    if (!isManual) {
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (lastCheck) {
        const elapsed = Date.now() - parseInt(lastCheck, 10);
        if (elapsed < CHECK_COOLDOWN_MS) {
          return null;
        }
      }
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PocketWise-App-Updater',
        },
      });

      if (!response.ok) {
        if (isManual) {
          console.warn(`[AppUpdateService] GitHub release fetch returned HTTP ${response.status}`);
        }
        return null;
      }

      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

      const data = await response.json();
      const rawTag: string = data.tag_name || data.name || '';
      const remoteVersion = rawTag.replace(/^v/, '').trim();
      const currentVersion = await this.getInstalledVersion();

      if (!remoteVersion) return null;

      const isNewer = compareSemver(remoteVersion, currentVersion) > 0;
      if (!isNewer) {
        return null;
      }

      // Find the APK asset in the release
      const assets: any[] = data.assets || [];
      const apkAsset = assets.find(
        (a) => a.name && (a.name.toLowerCase().endsWith('.apk') || a.content_type === 'application/vnd.android.package-archive')
      );

      // If no APK asset is attached to GitHub release, fallback to standard repository release download URL
      const apkUrl = apkAsset?.browser_download_url || `https://github.com/${GITHUB_REPO}/releases/download/${rawTag}/PocketWise-release.apk`;

      return {
        version: remoteVersion,
        currentVersion,
        name: data.name || `PocketWise v${remoteVersion}`,
        changelog: data.body || 'Performance improvements and bug fixes.',
        apkUrl,
        apkSize: apkAsset?.size,
        publishedAt: data.published_at || new Date().toISOString(),
        htmlUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      };
    } catch (err) {
      if (isManual) {
        console.warn('[AppUpdateService] Check update failed:', err);
      }
      return null;
    }
  }

  /**
   * Download the APK with progress callback
   */
  async downloadApk(
    apkUrl: string,
    version: string,
    onProgress: (progress: number, written: number, total: number) => void
  ): Promise<string> {
    const filename = `PocketWise-v${version}.apk`;
    const targetUri = `${FileSystem.cacheDirectory}${filename}`;

    // Clean up any old partial download if exists
    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
    } catch {}

    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      targetUri,
      {},
      (downloadProgress) => {
        const total = downloadProgress.totalBytesExpectedToWrite;
        const written = downloadProgress.totalBytesWritten;
        const ratio = total > 0 ? written / total : 0;
        onProgress(ratio, written, total);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      throw new Error('Failed to download update APK file.');
    }

    return result.uri;
  }

  /**
   * Trigger the Android Native Package Installer for the downloaded APK
   */
  async installApk(fileUri: string): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('In-app APK installation is only supported on Android.');
    }

    // Check if unknown app installation permission is granted on Android 8.0+
    if (PocketWiseSmsModule?.canInstallUnknownApps) {
      try {
        const canInstall = await PocketWiseSmsModule.canInstallUnknownApps();
        if (!canInstall) {
          if (PocketWiseSmsModule?.openInstallPermissionSettings) {
            await PocketWiseSmsModule.openInstallPermissionSettings();
          }
          throw new Error('Please toggle "Allow from this source" in Android settings, then tap Install Now again.');
        }
      } catch (permErr: any) {
        if (permErr?.message?.includes('Allow from this source')) {
          throw permErr;
        }
      }
    }

    try {
      // Convert file:// URI to content:// URI via FileProvider
      const contentUri = await FileSystem.getContentUriAsync(fileUri);

      // Launch Android system Package Installer with FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (268435456)
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 268435457, // 1 | 268435456
        type: 'application/vnd.android.package-archive',
      });
    } catch (primaryErr) {
      console.warn('[AppUpdateService] IntentLauncher failed, trying fallback sharing:', primaryErr);
      // Fallback: system share dialog which hands APK to package installer
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.android.package-archive',
        dialogTitle: 'Install PocketWise Update',
      });
    }
  }
}

export const updateService = new AppUpdateService();
