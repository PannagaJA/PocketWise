jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    PocketWiseSmsModule: {
      getAppVersion: jest.fn().mockResolvedValue({ versionName: '1.0.0', versionCode: 1 }),
      canInstallUnknownApps: jest.fn().mockResolvedValue(true),
      openInstallPermissionSettings: jest.fn().mockResolvedValue(true),
    },
  },
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn().mockResolvedValue({}),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getContentUriAsync: jest.fn().mockResolvedValue('content://mock.file.provider/apk'),
  createDownloadResumable: jest.fn(() => ({
    downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///mock/cache/PocketWise-v1.0.1.apk' }),
  })),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
}));

import { compareSemver, updateService } from '../lib/services/update.service';

describe('AppUpdateService - In-App APK Updater', () => {
  describe('compareSemver', () => {
    it('detects newer minor/patch versions', () => {
      expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
      expect(compareSemver('v1.1.0', 'v1.0.9')).toBe(1);
      expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    });

    it('detects older versions', () => {
      expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
      expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
    });

    it('detects equal versions with or without "v" prefix', () => {
      expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
      expect(compareSemver('v1.2.3', 'v1.2.3')).toBe(0);
    });
  });

  describe('updateService', () => {
    it('returns current version string', () => {
      const version = updateService.getCurrentVersion();
      expect(version).toBe('1.0.0');
    });

    it('installs APK using IntentLauncher on Android', async () => {
      const { startActivityAsync } = require('expo-intent-launcher');
      await updateService.installApk('file:///mock/cache/update.apk');
      expect(startActivityAsync).toHaveBeenCalledWith(
        'android.intent.action.VIEW',
        expect.objectContaining({
          data: 'content://mock.file.provider/apk',
          type: 'application/vnd.android.package-archive',
        })
      );
    });
  });
});
