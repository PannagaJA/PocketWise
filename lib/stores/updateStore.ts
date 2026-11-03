import { create } from 'zustand';
import { updateService, AppReleaseInfo } from '../services/update.service';
import { notificationService } from '../notifications/notification.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export type DownloadStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';

interface UpdateStore {
  updateInfo: AppReleaseInfo | null;
  status: DownloadStatus;
  progress: number; // 0 to 1
  bytesWritten: number;
  totalBytes: number;
  errorMessage: string | null;
  downloadedFilePath: string | null;
  modalVisible: boolean;

  checkForUpdates: (manual?: boolean) => Promise<boolean>;
  startDownload: () => Promise<void>;
  installDownloadedApk: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  updateInfo: null,
  status: 'idle',
  progress: 0,
  bytesWritten: 0,
  totalBytes: 0,
  errorMessage: null,
  downloadedFilePath: null,
  modalVisible: false,

  openModal: () => set({ modalVisible: true }),
  closeModal: () => {
    // Only close if not actively downloading
    if (get().status === 'downloading') return;
    set({ modalVisible: false });
  },

  reset: () =>
    set({
      status: 'idle',
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      errorMessage: null,
      modalVisible: false,
    }),

  checkForUpdates: async (manual = false) => {
    set({ status: 'checking', errorMessage: null });
    try {
      const release = await updateService.checkForUpdate(manual);
      if (release) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        // Send a system push notification so the user sees it in their notification tray
        try {
          const NOTIFIED_KEY = 'pocketwise_last_notified_update_version';
          const lastNotified = await AsyncStorage.getItem(NOTIFIED_KEY);
          if (lastNotified !== release.version) {
            await notificationService.sendSystemAlert({
              id: `app_update_${release.version}`,
              category: 'system',
              title: 'PocketWise Update Available 🚀',
              body: `PocketWise v${release.version} is ready. Tap to download and install.`,
              priority: 'high',
              data: {
                type: 'app_update',
                version: release.version,
              },
            });
            await AsyncStorage.setItem(NOTIFIED_KEY, release.version);
          }
        } catch (notifErr) {
          console.warn('[UpdateStore] Could not post update system notification:', notifErr);
        }

        set({
          updateInfo: release,
          status: 'idle',
          modalVisible: true,
        });
        return true;
      } else {
        set({ status: 'idle' });
        return false;
      }
    } catch (err: any) {
      set({ status: 'idle', errorMessage: err.message || 'Check failed' });
      return false;
    }
  },

  startDownload: async () => {
    const { updateInfo, status } = get();
    if (!updateInfo || status === 'downloading') return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    set({
      status: 'downloading',
      progress: 0,
      bytesWritten: 0,
      totalBytes: updateInfo.apkSize || 0,
      errorMessage: null,
    });

    try {
      const localPath = await updateService.downloadApk(
        updateInfo.apkUrl,
        updateInfo.version,
        (ratio, written, total) => {
          set({
            progress: ratio,
            bytesWritten: written,
            totalBytes: total,
          });
        }
      );

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      set({
        status: 'downloaded',
        downloadedFilePath: localPath,
        progress: 1,
      });

      // Automatically launch the installer once downloaded
      await updateService.installApk(localPath);
    } catch (err: any) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      set({
        status: 'error',
        errorMessage: err.message || 'Failed to download update APK.',
      });
    }
  },

  installDownloadedApk: async () => {
    const { downloadedFilePath } = get();
    if (!downloadedFilePath) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await updateService.installApk(downloadedFilePath);
    } catch (err: any) {
      set({
        status: 'error',
        errorMessage: err.message || 'Failed to trigger package installer.',
      });
    }
  },
}));

