const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

function withAndroidSmsReceiver(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Ensure permissions
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.RECEIVE_SMS');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.READ_SMS');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.POST_NOTIFICATIONS');

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    // Add BroadcastReceiver if not already present
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const receiverName = '.sms.PocketWiseSmsReceiver';
    const exists = mainApplication.receiver.some(
      (r) => r.$['android:name'] === receiverName || r.$['android:name'] === 'com.pocketwise.app.sms.PocketWiseSmsReceiver'
    );

    if (!exists) {
      mainApplication.receiver.push({
        $: {
          'android:name': receiverName,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            $: {
              'android:priority': '999',
            },
            action: [
              {
                $: {
                  'android:name': 'android.provider.Telephony.SMS_RECEIVED',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withAndroidSmsReceiver;
