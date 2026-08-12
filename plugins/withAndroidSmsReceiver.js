const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAndroidSmsReceiver(config) {
  // 1. AndroidManifest configuration for permissions, broadcast receiver, and notification listener service
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Ensure permissions
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.RECEIVE_SMS');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.READ_SMS');
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.POST_NOTIFICATIONS');

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const receiverName = '.sms.PocketWiseSmsReceiver';
    let receiverObj = mainApplication.receiver.find(
      (r) => r.$['android:name'] === receiverName || r.$['android:name'] === 'com.pocketwise.app.sms.PocketWiseSmsReceiver'
    );

    if (!receiverObj) {
      receiverObj = {
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
              {
                $: {
                  'android:name': 'com.pocketwise.TEST_SMS_RECEIVER',
                },
              },
            ],
          },
        ],
      };
      mainApplication.receiver.push(receiverObj);
    } else {
      const filter = receiverObj['intent-filter']?.[0];
      if (filter) {
        if (!filter.action) filter.action = [];
        const hasTestAction = filter.action.some((a) => a.$['android:name'] === 'com.pocketwise.TEST_SMS_RECEIVER');
        if (!hasTestAction) {
          filter.action.push({
            $: {
              'android:name': 'com.pocketwise.TEST_SMS_RECEIVER',
            },
          });
        }
      }
    }

    // Register PocketWiseNotificationListenerService in Manifest
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = '.sms.PocketWiseNotificationListenerService';
    let serviceObj = mainApplication.service.find(
      (s) => s.$['android:name'] === serviceName || s.$['android:name'] === 'com.pocketwise.app.sms.PocketWiseNotificationListenerService'
    );

    if (!serviceObj) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:label': 'PocketWise SMS Detection',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });

  // 2. Dangerous mod to write Kotlin SMS files and register package in MainApplication
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'pocketwise',
        'app',
        'sms'
      );

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // PocketWiseSmsReceiver.kt
      const receiverContent = `package com.pocketwise.app.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

class PocketWiseSmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        Log.e("PocketWiseSmsReceiver", "=== RECEIVER INVOKED === action=\${intent?.action}")

        if (context == null || intent == null) {
            Log.w(TAG, "Received null context or intent")
            return
        }

        val action = intent.action

        // Diagnostic Custom Action Check
        if (TEST_ACTION == action) {
            Log.e("PocketWiseSmsReceiver", "=== CUSTOM TEST RECEIVER WORKS ===")
            return
        }

        val isSmsAction = Telephony.Sms.Intents.SMS_RECEIVED_ACTION == action
        Log.d(TAG, "Action equals SMS_RECEIVED_ACTION: $isSmsAction")

        if (!isSmsAction) {
            Log.d(TAG, "Ignoring non-SMS intent action: $action")
            return
        }

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            val msgCount = messages?.size ?: 0
            Log.d(TAG, "Extracted SMS message count: $msgCount")

            if (messages.isNullOrEmpty()) {
                Log.w(TAG, "Messages array is null or empty from SMS_RECEIVED intent")
                return
            }

            val rawSender = messages[0].originatingAddress ?: "Unknown"
            val timestamp = messages[0].timestampMillis

            val bodyBuilder = StringBuilder()
            for (msg in messages) {
                val part = msg.messageBody
                if (part != null) {
                    bodyBuilder.append(part)
                }
            }
            val body = bodyBuilder.toString()
            val bodyLength = body.length

            Log.d(TAG, "SMS extracted. Sender: $rawSender, Body length: $bodyLength, Timestamp: $timestamp")

            val stableId = generateSmsId(rawSender, timestamp, body)

            val smsJson = JSONObject().apply {
                put("id", stableId)
                put("sender", rawSender)
                put("body", body)
                put("timestamp", timestamp)
            }

            val queued = queueUnprocessedSms(context, smsJson)
            Log.d(TAG, "SMS native queue status: $queued for ID: $stableId")

            val emitted = PocketWiseSmsModule.emitSmsEvent(smsJson)
            Log.d(TAG, "React Native event emission result: $emitted")

        } catch (e: Exception) {
            Log.e(TAG, "Unhandled exception in PocketWiseSmsReceiver onReceive", e)
        }
    }

    private fun queueUnprocessedSms(context: Context, smsJson: JSONObject): Boolean {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existingString = prefs.getString(QUEUE_KEY, "[]") ?: "[]"
            val array = JSONArray(existingString)

            val newId = smsJson.optString("id")
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i)
                if (item != null && item.optString("id") == newId) {
                    Log.d(TAG_QUEUE, "SMS already exists in native queue, skipping duplicate enqueue: $newId")
                    return true
                }
            }

            array.put(smsJson)
            prefs.edit().putString(QUEUE_KEY, array.toString()).apply()
            Log.d(TAG_QUEUE, "Successfully persisted SMS to native SharedPreferences queue. Total pending: \${array.length()}")
            true
        } catch (e: Exception) {
            Log.e(TAG_QUEUE, "Error persisting SMS to native SharedPreferences queue", e)
            false
        }
    }

    private fun generateSmsId(sender: String, timestamp: Long, body: String): String {
        return try {
            val rawKey = "$sender:$timestamp:$body"
            val bytes = MessageDigest.getInstance("MD5").digest(rawKey.toByteArray())
            val hex = bytes.joinToString("") { "%02x".format(it) }
            "sms_$hex"
        } catch (e: Exception) {
            "sms_\${timestamp}_\${body.hashCode()}"
        }
    }

    companion object {
        private const val TAG = "PocketWiseSmsReceiver"
        private const val TAG_QUEUE = "PocketWiseSmsQueue"
        private const val PREFS_NAME = "pocketwise_sms_prefs"
        private const val QUEUE_KEY = "unprocessed_sms_queue"
        private const val TEST_ACTION = "com.pocketwise.TEST_SMS_RECEIVER"
    }
}
`;

      // PocketWiseSmsModule.kt
      const moduleContent = `package com.pocketwise.app.sms

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.util.Log
import org.json.JSONObject

class PocketWiseSmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        companionReactContext = reactContext
    }

    override fun getName(): String {
        return "PocketWiseSmsModule"
    }

    override fun initialize() {
        super.initialize()
        companionReactContext = reactApplicationContext
    }

    @ReactMethod
    fun getUnprocessedSms(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("pocketwise_sms_prefs", Context.MODE_PRIVATE)
            val queueString = prefs.getString("unprocessed_sms_queue", "[]") ?: "[]"
            promise.resolve(queueString)
        } catch (e: Exception) {
            promise.reject("READ_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun readRecentInboxSms(promise: Promise) {
        try {
            val cursor = reactContext.contentResolver.query(
                android.net.Uri.parse("content://sms/inbox"),
                arrayOf("_id", "address", "body", "date"),
                null,
                null,
                "date DESC LIMIT 30"
            )

            val array = WritableNativeArray()
            cursor?.use { c ->
                val idIdx = c.getColumnIndex("_id")
                val addressIdx = c.getColumnIndex("address")
                val bodyIdx = c.getColumnIndex("body")
                val dateIdx = c.getColumnIndex("date")

                while (c.moveToNext()) {
                    val map = WritableNativeMap()
                    map.putString("id", "inbox_" + if (idIdx != -1) c.getString(idIdx) else "")
                    map.putString("sender", if (addressIdx != -1) c.getString(addressIdx) ?: "" else "")
                    map.putString("body", if (bodyIdx != -1) c.getString(bodyIdx) ?: "" else "")
                    map.putDouble("timestamp", if (dateIdx != -1) c.getLong(dateIdx).toDouble() else 0.0)
                    array.pushMap(map)
                }
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("INBOX_READ_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearUnprocessedSms(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("pocketwise_sms_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString("unprocessed_sms_queue", "[]").apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        try {
            val packageName = reactContext.packageName
            val flat = android.provider.Settings.Secure.getString(
                reactContext.contentResolver,
                "enabled_notification_listeners"
            )
            val isEnabled = flat != null && flat.contains(packageName)
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.reject("CHECK_LISTENER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openNotificationListenerSettings(promise: Promise) {
        try {
            val intent = android.content.Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun checkPermissionState(promise: Promise) {
        try {
            val receiveGranted = ContextCompat.checkSelfPermission(
                reactContext,
                android.Manifest.permission.RECEIVE_SMS
            ) == PackageManager.PERMISSION_GRANTED

            val readGranted = ContextCompat.checkSelfPermission(
                reactContext,
                android.Manifest.permission.READ_SMS
            ) == PackageManager.PERMISSION_GRANTED

            val flat = android.provider.Settings.Secure.getString(
                reactContext.contentResolver,
                "enabled_notification_listeners"
            )
            val listenerEnabled = flat != null && flat.contains(reactContext.packageName)

            val resultMap = Arguments.createMap().apply {
                putBoolean("receiveSms", receiveGranted)
                putBoolean("readSms", readGranted)
                putBoolean("notificationListener", listenerEnabled)
                putBoolean("granted", (receiveGranted && readGranted) || listenerEnabled)
            }
            promise.resolve(resultMap)
        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", e.message, e)
        }
    }

    companion object {
        private var companionReactContext: ReactApplicationContext? = null

        fun emitSmsEvent(smsJson: JSONObject): Boolean {
            val context = companionReactContext
            if (context != null && context.hasActiveReactInstance()) {
                try {
                    val map = Arguments.createMap().apply {
                        putString("id", smsJson.optString("id"))
                        putString("sender", smsJson.optString("sender"))
                        putString("body", smsJson.optString("body"))
                        putDouble("timestamp", smsJson.optDouble("timestamp"))
                    }
                    context
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onSmsReceived", map)
                    Log.d("PocketWiseSmsModule", "Successfully emitted onSmsReceived event to active React Native instance")
                    return true
                } catch (e: Exception) {
                    Log.e("PocketWiseSmsModule", "Error emitting event to React Native", e)
                }
            } else {
                Log.d("PocketWiseSmsModule", "React Native runtime unavailable. Event cached in native queue.")
            }
            return false
        }
    }
}
`;

      // PocketWiseNotificationListenerService.kt
      const listenerContent = `package com.pocketwise.app.sms

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

class PocketWiseNotificationListenerService : NotificationListenerService() {

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "PocketWiseNotificationListenerService connected successfully")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "PocketWiseNotificationListenerService disconnected")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val pkgName = sbn.packageName ?: ""
        val isMessagingApp = isSupportedMessagingPackage(pkgName)

        if (!isMessagingApp) return

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title = extractStringExtra(extras, Notification.EXTRA_TITLE)
        val text = extractStringExtra(extras, Notification.EXTRA_TEXT)
        val bigText = extractStringExtra(extras, Notification.EXTRA_BIG_TEXT)

        val bodyText = when {
            !bigText.isNullOrBlank() -> bigText
            !text.isNullOrBlank() -> text
            else -> ""
        }

        val hasTitle = !title.isNullOrBlank()
        val hasText = bodyText.isNotBlank()

        if (!hasText) return

        val isBankCandidate = isLikelyBankMessage(title, bodyText)

        Log.d(TAG, "Notification posted. Package: $pkgName, Has title: $hasTitle, Has text: $hasText, Bank candidate: $isBankCandidate")

        if (!isBankCandidate) return

        val senderName = if (hasTitle) title!! else "Google Messages"
        val timestamp = sbn.postTime

        val stableId = generateSmsId(senderName, timestamp, bodyText)

        val smsJson = JSONObject().apply {
            put("id", stableId)
            put("sender", senderName)
            put("body", bodyText)
            put("timestamp", timestamp)
        }

        val queued = queueUnprocessedSms(applicationContext, smsJson)
        Log.d(TAG, "Notification SMS persisted to native queue: $queued for ID: $stableId")

        PocketWiseSmsModule.emitSmsEvent(smsJson)
    }

    private fun isSupportedMessagingPackage(pkgName: String): Boolean {
        return SUPPORTED_PACKAGES.contains(pkgName)
    }

    private fun isLikelyBankMessage(title: String?, text: String): Boolean {
        val combined = "$title $text".lowercase()

        // Filter out non-financial noise
        val noiseKeywords = listOf("otp", "one time password", "verification code", "secret code", "welcome to", "kyc", "cheque book", "statement is ready", "promotions", "marketing")
        if (noiseKeywords.some { combined.contains(it) }) {
            return false
        }

        // Financial indicator verbs/terms
        val financialKeywords = listOf(
            "debited", "credited", "spent", "paid", "transferred", "received", "withdrawn",
            "a/c", "acct", "account", "avbal", "avlbal", "bal:", "inr", "rs.", "rs ", "upi", "vpa", "ref", "rrn"
        )

        return financialKeywords.any { combined.contains(it) }
    }

    private fun extractStringExtra(extras: android.os.Bundle, key: String): String? {
        return try {
            val value = extras.get(key)
            when (value) {
                is CharSequence -> value.toString()
                is String -> value
                else -> value?.toString()
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun queueUnprocessedSms(context: Context, smsJson: JSONObject): Boolean {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existingString = prefs.getString(QUEUE_KEY, "[]") ?: "[]"
            val array = JSONArray(existingString)

            val newId = smsJson.optString("id")
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i)
                if (item != null && item.optString("id") == newId) {
                    Log.d(TAG_QUEUE, "SMS already exists in native queue, skipping duplicate enqueue: $newId")
                    return true
                }
            }

            array.put(smsJson)
            prefs.edit().putString(QUEUE_KEY, array.toString()).apply()
            Log.d(TAG_QUEUE, "Successfully persisted SMS from notification to native queue. Total pending: \${array.length()}")
            true
        } catch (e: Exception) {
            Log.e(TAG_QUEUE, "Error persisting SMS from notification to native queue", e)
            false
        }
    }

    private fun generateSmsId(sender: String, timestamp: Long, body: String): String {
        return try {
            val rawKey = "$sender:$timestamp:$body"
            val bytes = MessageDigest.getInstance("MD5").digest(rawKey.toByteArray())
            val hex = bytes.joinToString("") { "%02x".format(it) }
            "sms_$hex"
        } catch (e: Exception) {
            "sms_\${timestamp}_\${body.hashCode()}"
        }
    }

    private fun List<String>.some(predicate: (String) -> Boolean): Boolean {
        for (item in this) {
            if (predicate(item)) return true
        }
        return false
    }

    companion object {
        private const val TAG = "PocketWiseNotificationListener"
        private const val TAG_QUEUE = "PocketWiseSmsQueue"
        private const val PREFS_NAME = "pocketwise_sms_prefs"
        private const val QUEUE_KEY = "unprocessed_sms_queue"

        private val SUPPORTED_PACKAGES = setOf(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.oneplus.mms"
        )
    }
}
`;

      // PocketWiseSmsPackage.kt
      const packageContent = `package com.pocketwise.app.sms

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PocketWiseSmsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PocketWiseSmsModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

      fs.writeFileSync(path.join(targetDir, 'PocketWiseSmsReceiver.kt'), receiverContent);
      fs.writeFileSync(path.join(targetDir, 'PocketWiseSmsModule.kt'), moduleContent);
      fs.writeFileSync(path.join(targetDir, 'PocketWiseNotificationListenerService.kt'), listenerContent);
      fs.writeFileSync(path.join(targetDir, 'PocketWiseSmsPackage.kt'), packageContent);

      // Register PocketWiseSmsPackage in MainApplication.kt if not present
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
        if (!appContent.includes('PocketWiseSmsPackage()')) {
          appContent = appContent.replace(
            /PackageList\(this\)\.packages\.apply\s*\{/,
            'PackageList(this).packages.apply {\n              add(com.pocketwise.app.sms.PocketWiseSmsPackage())'
          );
          fs.writeFileSync(mainAppPath, appContent);
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidSmsReceiver;

