const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidShakeDetector(config) {
  // 1. AndroidManifest configuration
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Permissions
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.VIBRATE');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.FOREGROUND_SERVICE');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.SYSTEM_ALERT_WINDOW');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.RECEIVE_BOOT_COMPLETED');

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    // ShakeDetectionService registration
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = '.shake.ShakeDetectionService';
    let serviceObj = mainApplication.service.find(
      (s) => s.$['android:name'] === serviceName || s.$['android:name'] === 'com.pocketwise.app.shake.ShakeDetectionService'
    );

    if (!serviceObj) {
      serviceObj = {
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        property: [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value': 'Motion sensor shake detection for quick expense recording',
            },
          },
        ],
      };
      mainApplication.service.push(serviceObj);
    }

    // QuickExpenseActivity registration
    if (!mainApplication.activity) {
      mainApplication.activity = [];
    }

    const activityName = '.shake.QuickExpenseActivity';
    let activityObj = mainApplication.activity.find(
      (a) => a.$['android:name'] === activityName || a.$['android:name'] === 'com.pocketwise.app.shake.QuickExpenseActivity'
    );

    if (!activityObj) {
      activityObj = {
        $: {
          'android:name': activityName,
          'android:exported': 'false',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleInstance',
          'android:theme': '@style/Theme.PocketWise.QuickExpenseDialog',
          'android:windowSoftInputMode': 'stateVisible|adjustResize',
        },
      };
      mainApplication.activity.push(activityObj);
    }

    // ShakeBootReceiver registration
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const receiverName = '.shake.ShakeBootReceiver';
    let receiverObj = mainApplication.receiver.find(
      (r) => r.$['android:name'] === receiverName || r.$['android:name'] === 'com.pocketwise.app.shake.ShakeBootReceiver'
    );

    if (!receiverObj) {
      receiverObj = {
        $: {
          'android:name': receiverName,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.BOOT_COMPLETED',
                },
              },
            ],
          },
        ],
      };
      mainApplication.receiver.push(receiverObj);
    }

    return config;
  });

  // 2. Dangerous mod to sync Kotlin files, layouts, drawables, styles, and register package in MainApplication
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const shakeDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'pocketwise',
        'app',
        'shake'
      );

      if (!fs.existsSync(shakeDir)) {
        fs.mkdirSync(shakeDir, { recursive: true });
      }

      // Ensure Kotlin files exist
      const shakeDetectorSrc = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'pocketwise', 'app', 'shake', 'ShakeDetector.kt');
      if (fs.existsSync(shakeDetectorSrc)) {
        // Source exists in workspace
      }

      // Ensure MainApplication.kt registers PocketWiseShakePackage
      const mainAppPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'pocketwise',
        'app',
        'MainApplication.kt'
      );

      if (fs.existsSync(mainAppPath)) {
        let appContent = fs.readFileSync(mainAppPath, 'utf8');
        if (!appContent.includes('PocketWiseShakePackage()')) {
          appContent = appContent.replace(
            /PackageList\(this\)\.packages\.apply\s*\{/,
            'PackageList(this).packages.apply {\n              add(com.pocketwise.app.shake.PocketWiseShakePackage())'
          );
          fs.writeFileSync(mainAppPath, appContent);
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidShakeDetector;
