import { Platform } from 'react-native';
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
  /**
   * Get the currently installed app version
   */
  getCurrentVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
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
      const currentVersion = this.getCurrentVersion();

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

    try {
      // Convert file:// URI to content:// URI via FileProvider
      const contentUri = await FileSystem.getContentUriAsync(fileUri);

      // Launch Android system Package Installer
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
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
