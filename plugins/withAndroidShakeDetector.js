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

  // 2. Dangerous mod to write all Kotlin files, XML layouts, drawables, styles, and register package in MainApplication.kt
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

      // 2a. ShakeDetector.kt
      const shakeDetectorContent = `package com.pocketwise.app.shake

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import kotlin.math.sqrt

/**
 * ShakeDetector detects intentional device shakes using the physical accelerometer.
 * Features:
 * - Isotropic acceleration evaluation combining dynamic low-pass gravity filtering and total G-force.
 * - Robust state machine requiring distinct directional peaks separated in time (filters walking, table bumps).
 * - Configurable sensitivity (LOW, NORMAL, HIGH).
 * - Cooldown/debounce to prevent duplicate triggers from a single physical shake.
 * - Thread-safe active state suppression when a popup is already displayed.
 */
class ShakeDetector(private val onShakeListener: () -> Unit) : SensorEventListener {

    var sensitivity: Sensitivity = Sensitivity.NORMAL

    // Gravity components isolated via low-pass filter
    private var gravityX = 0f
    private var gravityY = 0f
    private var gravityZ = 0f
    private var isGravityInitialized = false

    private var lastShakeTimestamp: Long = 0
    private var lastPeakTimestamp: Long = 0
    private val peakTimestamps = mutableListOf<Long>()

    enum class Sensitivity(
        val linearThreshold: Float,  // m/s^2 linear acceleration (gravity removed)
        val gForceThreshold: Float   // total G-force threshold
    ) {
        LOW(12.0f, 1.90f),     // Requires a firmer, deliberate shake
        NORMAL(8.0f, 1.50f),   // Standard intentional shake (balanced)
        HIGH(5.5f, 1.25f)      // Lighter shake
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) {
            return
        }

        // If a popup or expense flow is already active, ignore movement
        if (isPopupActive) {
            return
        }

        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        // 1. Dynamic low-pass filter to isolate the gravity vector
        if (!isGravityInitialized) {
            gravityX = x
            gravityY = y
            gravityZ = z
            isGravityInitialized = true
        } else {
            gravityX = ALPHA * gravityX + (1f - ALPHA) * x
            gravityY = ALPHA * gravityY + (1f - ALPHA) * y
            gravityZ = ALPHA * gravityZ + (1f - ALPHA) * z
        }

        // 2. Isotropic Linear Acceleration (Gravity vector subtracted component-wise)
        val linearX = x - gravityX
        val linearY = y - gravityY
        val linearZ = z - gravityZ
        val linearMagnitude = sqrt((linearX * linearX + linearY * linearY + linearZ * linearZ).toDouble()).toFloat()

        // 3. Total G-Force magnitude
        val totalMagnitude = sqrt((x * x + y * y + z * z).toDouble()).toFloat()
        val gForce = totalMagnitude / SensorManager.GRAVITY_EARTH

        val now = System.currentTimeMillis()
        val currentSensitivity = sensitivity

        // A valid motion peak occurs if either linear acceleration or total g-force crosses the sensitivity threshold
        val isThresholdExceeded = linearMagnitude >= currentSensitivity.linearThreshold ||
                gForce >= currentSensitivity.gForceThreshold

        if (isThresholdExceeded) {
            // Require at least MIN_PEAK_INTERVAL_MS between recorded peaks to count distinct motion strokes
            if (now - lastPeakTimestamp >= MIN_PEAK_INTERVAL_MS) {
                lastPeakTimestamp = now
                peakTimestamps.add(now)
            }

            // Prune peaks outside the sliding temporal window
            peakTimestamps.removeAll { now - it > PEAK_WINDOW_MS }

            // Require at least REQUIRED_PEAKS distinct motion strokes within the sliding window
            if (peakTimestamps.size >= REQUIRED_PEAKS) {
                if (lastShakeTimestamp == 0L || now - lastShakeTimestamp >= COOLDOWN_MS) {
                    lastShakeTimestamp = now
                    peakTimestamps.clear()
                    Log.d(TAG, "Intentional shake detected! Linear: $linearMagnitude m/s^2, G-Force: \${gForce}g, Sensitivity: $currentSensitivity")
                    onShakeListener()
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op for accelerometer accuracy changes
    }

    companion object {
        private const val TAG = "ShakeDetector"
        private const val ALPHA = 0.85f // Low-pass filter factor for gravity estimation
        private const val MIN_PEAK_INTERVAL_MS = 80L // Minimum separation between distinct shake strokes
        private const val PEAK_WINDOW_MS = 650L // Sliding window to accumulate shake peaks
        private const val REQUIRED_PEAKS = 2 // Number of distinct strokes required to confirm shake
        private const val COOLDOWN_MS = 2500L // Debounce cooldown after shake trigger

        @Volatile
        var isPopupActive: Boolean = false
    }
}
`;

      // 2b. ShakeDetectionService.kt
      const shakeServiceContent = `package com.pocketwise.app.shake

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.pocketwise.app.R

class ShakeDetectionService : Service() {

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var shakeDetector: ShakeDetector? = null
    private var isListening = false

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "ShakeDetectionService onCreate")
        isServiceRunning = true
        createNotificationChannel()
        startForegroundServiceNotification()
        initShakeDetector()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "ShakeDetectionService onStartCommand action=$action")

        when (action) {
            ACTION_STOP -> {
                Log.d(TAG, "Stopping ShakeDetectionService by intent request")
                stopListening()
                stopForeground(true)
                stopSelf()
                isServiceRunning = false
                return START_NOT_STICKY
            }
            ACTION_UPDATE_SENSITIVITY -> {
                val sensStr = intent.getStringExtra("sensitivity") ?: "NORMAL"
                val sens = try {
                    ShakeDetector.Sensitivity.valueOf(sensStr)
                } catch (e: Exception) {
                    ShakeDetector.Sensitivity.NORMAL
                }
                shakeDetector?.sensitivity = sens
                Log.d(TAG, "Updated shake detector sensitivity to: $sens")
            }
            ACTION_SET_BACKGROUND_ENABLED -> {
                val bgEnabled = intent.getBooleanExtra("backgroundEnabled", true)
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putBoolean(KEY_BACKGROUND_ENABLED, bgEnabled).apply()
                Log.d(TAG, "Updated background shake detection preference to: $bgEnabled")
            }
            else -> {
                startListening()
            }
        }

        return START_STICKY
    }

    private fun initShakeDetector() {
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val sensStr = prefs.getString(KEY_SENSITIVITY, "NORMAL") ?: "NORMAL"
        val initialSensitivity = try {
            ShakeDetector.Sensitivity.valueOf(sensStr)
        } catch (e: Exception) {
            ShakeDetector.Sensitivity.NORMAL
        }

        shakeDetector = ShakeDetector {
            handleShakeTriggered()
        }.apply {
            sensitivity = initialSensitivity
        }
    }

    private fun startListening() {
        if (isListening || accelerometer == null) return

        sensorManager?.registerListener(
            shakeDetector,
            accelerometer,
            SensorManager.SENSOR_DELAY_GAME
        )
        isListening = true
        isServiceRunning = true
        Log.d(TAG, "ShakeDetectionService started listening on accelerometer (SENSOR_DELAY_GAME)")
    }

    private fun stopListening() {
        if (!isListening) return

        sensorManager?.unregisterListener(shakeDetector)
        isListening = false
        Log.d(TAG, "ShakeDetectionService stopped listening on accelerometer")
    }

    private fun handleShakeTriggered() {
        Log.d(TAG, "Shake event triggered from ShakeDetectionService")

        // First attempt to emit to foreground React Native instance
        val emittedToRN = PocketWiseShakeModule.emitShakeDetected()

        if (!emittedToRN) {
            // Check if background detection is enabled in preferences
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isBackgroundAllowed = prefs.getBoolean(KEY_BACKGROUND_ENABLED, true)

            if (!isBackgroundAllowed) {
                Log.d(TAG, "Background shake detection is disabled by user preference; ignoring background shake")
                return
            }

            // App is backgrounded / sleeping -> check overlay permission and launch floating activity
            val canOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(this)
            } else {
                true
            }

            Log.d(TAG, "Background shake triggered. Overlay permission granted: $canOverlay")

            if (canOverlay) {
                try {
                    val popupIntent = Intent(this, QuickExpenseActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    startActivity(popupIntent)
                    Log.d(TAG, "Launched QuickExpenseActivity from background shake")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to launch QuickExpenseActivity directly", e)
                    showQuickExpenseNotification()
                }
            } else {
                Log.w(TAG, "Overlay permission not granted; falling back to high-priority notification")
                showQuickExpenseNotification()
            }
        }
    }

    private fun showQuickExpenseNotification() {
        val popupIntent = Intent(this, QuickExpenseActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_POPUP_REQUEST_CODE,
            popupIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⚡ Quick Expense")
            .setContentText("Tap to record an expense from shake")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.notify(NOTIFICATION_ALERT_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Quick Expense Shake Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background sensor monitoring for Shake to Add Expense"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceNotification() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("PocketWise Shake Active")
            .setContentText("Shake your phone anytime to record an expense")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+ (API 34/35)
            startForeground(
                NOTIFICATION_SERVICE_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_SERVICE_ID, notification)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopListening()
        ShakeDetector.isPopupActive = false
        isServiceRunning = false
        Log.d(TAG, "ShakeDetectionService destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val TAG = "ShakeDetectionService"
        const val ACTION_START = "com.pocketwise.app.shake.ACTION_START"
        const val ACTION_STOP = "com.pocketwise.app.shake.ACTION_STOP"
        const val ACTION_UPDATE_SENSITIVITY = "com.pocketwise.app.shake.ACTION_UPDATE_SENSITIVITY"
        const val ACTION_SET_BACKGROUND_ENABLED = "com.pocketwise.app.shake.ACTION_SET_BACKGROUND_ENABLED"

        private const val CHANNEL_ID = "pocketwise_shake_channel"
        private const val NOTIFICATION_SERVICE_ID = 2001
        private const val NOTIFICATION_ALERT_ID = 2002
        private const val NOTIFICATION_POPUP_REQUEST_CODE = 3001

        private const val PREFS_NAME = "pocketwise_shake_prefs"
        private const val KEY_SENSITIVITY = "shake_sensitivity"
        private const val KEY_BACKGROUND_ENABLED = "is_background_enabled"

        @Volatile
        var isServiceRunning: Boolean = false
    }
}
`;

      // 2c. PocketWiseShakeModule.kt
      const shakeModuleContent = `package com.pocketwise.app.shake

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

class PocketWiseShakeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        companionReactContext = reactContext
    }

    override fun getName(): String {
        return "PocketWiseShakeModule"
    }

    override fun initialize() {
        super.initialize()
        companionReactContext = reactApplicationContext
    }

    @ReactMethod
    fun startShakeService(promise: Promise) {
        try {
            val intent = Intent(reactContext, ShakeDetectionService::class.java).apply {
                action = ShakeDetectionService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_SERVICE_ENABLED, true).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting shake service", e)
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopShakeService(promise: Promise) {
        try {
            val intent = Intent(reactContext, ShakeDetectionService::class.java).apply {
                action = ShakeDetectionService.ACTION_STOP
            }
            reactContext.stopService(intent)

            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_SERVICE_ENABLED, false).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping shake service", e)
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isShakeServiceRunning(promise: Promise) {
        try {
            val isRunning = ShakeDetectionService.isServiceRunning
            promise.resolve(isRunning)
        } catch (e: Exception) {
            promise.reject("CHECK_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setBackgroundShakeEnabled(enabled: Boolean, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_BACKGROUND_ENABLED, enabled).apply()

            val intent = Intent(reactContext, ShakeDetectionService::class.java).apply {
                action = ShakeDetectionService.ACTION_SET_BACKGROUND_ENABLED
                putExtra("backgroundEnabled", enabled)
            }
            reactContext.startService(intent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_BACKGROUND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setShakeSensitivity(sensitivity: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_SENSITIVITY, sensitivity.uppercase()).apply()

            // Broadcast sensitivity update to running service
            val intent = Intent(reactContext, ShakeDetectionService::class.java).apply {
                action = ShakeDetectionService.ACTION_UPDATE_SENSITIVITY
                putExtra("sensitivity", sensitivity.uppercase())
            }
            reactContext.startService(intent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_SENSITIVITY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val granted = Settings.canDrawOverlays(reactContext)
                Log.d(TAG, "checkOverlayPermission evaluated: $granted")
                promise.resolve(granted)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("CHECK_OVERLAY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:\${reactContext.packageName}")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(intent)
                } catch (e: Exception) {
                    // Fallback to generic overlay settings screen if package-specific URI is not supported
                    val fallbackIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(fallbackIntent)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REQUEST_OVERLAY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun syncUserData(
        userId: String,
        supabaseUrl: String,
        supabaseAnonKey: String,
        accessToken: String,
        accountsJson: String,
        categoriesJson: String,
        promise: Promise
    ) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putString(KEY_USER_ID, userId)
                putString(KEY_SUPABASE_URL, supabaseUrl)
                putString(KEY_SUPABASE_ANON_KEY, supabaseAnonKey)
                putString(KEY_ACCESS_TOKEN, accessToken)
                putString(KEY_ACCOUNTS, accountsJson)
                putString(KEY_CATEGORIES, categoriesJson)
            }.apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SYNC_USER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearUserData(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                remove(KEY_USER_ID)
                remove(KEY_ACCESS_TOKEN)
                remove(KEY_ACCOUNTS)
                remove(KEY_CATEGORIES)
            }.apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_USER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun simulateShake(promise: Promise) {
        try {
            val emitted = emitShakeDetected()
            if (!emitted) {
                // If React Native is not actively in foreground, open QuickExpenseActivity directly
                val intent = Intent(reactContext, QuickExpenseActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                reactContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SIMULATE_SHAKE_ERROR", e.message, e)
        }
    }

    companion object {
        private const val TAG = "PocketWiseShakeModule"
        private const val PREFS_NAME = "pocketwise_shake_prefs"
        private const val KEY_SERVICE_ENABLED = "is_shake_enabled"
        private const val KEY_BACKGROUND_ENABLED = "is_background_enabled"
        private const val KEY_SENSITIVITY = "shake_sensitivity"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_SUPABASE_URL = "supabase_url"
        private const val KEY_SUPABASE_ANON_KEY = "supabase_anon_key"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_ACCOUNTS = "cached_accounts"
        private const val KEY_CATEGORIES = "cached_categories"

        private var companionReactContext: ReactApplicationContext? = null

        fun getReactContext(): ReactApplicationContext? = companionReactContext

        fun emitShakeDetected(): Boolean {
            val context = companionReactContext
            if (context != null && context.hasActiveReactInstance()) {
                val isForeground = try {
                    context.lifecycleState == com.facebook.react.common.LifecycleState.RESUMED
                } catch (e: Exception) {
                    false
                }

                if (isForeground) {
                    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onShakeDetected", null)
                    Log.d(TAG, "Emitted onShakeDetected event to foreground React Native instance")
                    return true
                }
            }
            return false
        }

        fun emitExpenseSubmitted(
            id: String,
            amountMinor: Long,
            description: String,
            accountId: String,
            categoryId: String?,
            date: String
        ): Boolean {
            val context = companionReactContext
            if (context != null && context.hasActiveReactInstance()) {
                val params = Arguments.createMap().apply {
                    putString("id", id)
                    putDouble("amount_minor", amountMinor.toDouble())
                    putString("description", description)
                    putString("account_id", accountId)
                    if (categoryId != null) {
                        putString("category_id", categoryId)
                    }
                    putString("date", date)
                }
                context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onQuickExpenseSubmitted", params)
                return true
            }
            return false
        }

        fun emitExpenseCreated(txJson: JSONObject) {
            val context = companionReactContext
            if (context != null && context.hasActiveReactInstance()) {
                val params = Arguments.createMap().apply {
                    putString("id", txJson.optString("id"))
                    putString("account_id", txJson.optString("account_id"))
                    putDouble("amount_minor", txJson.optDouble("amount_minor"))
                    putString("description", txJson.optString("description"))
                    putString("date", txJson.optString("date"))
                    putString("currency", txJson.optString("currency", "INR"))
                }
                context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onQuickExpenseCreated", params)
            }
        }
    }
}
`;

      // 2d. PocketWiseShakePackage.kt
      const shakePackageContent = `package com.pocketwise.app.shake

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PocketWiseShakePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(PocketWiseShakeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

      // 2e. ShakeBootReceiver.kt
      const shakeBootReceiverContent = `package com.pocketwise.app.shake

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class ShakeBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent?.action != Intent.ACTION_BOOT_COMPLETED) {
            return
        }

        Log.d(TAG, "Device reboot completed, checking Shake to Add Expense preference")

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isEnabled = prefs.getBoolean(KEY_SERVICE_ENABLED, false)

        if (isEnabled) {
            Log.d(TAG, "Shake detection is enabled, starting ShakeDetectionService")
            val serviceIntent = Intent(context, ShakeDetectionService::class.java).apply {
                action = ShakeDetectionService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } else {
            Log.d(TAG, "Shake detection is disabled in user preferences, ignoring boot event")
        }
    }

    companion object {
        private const val TAG = "ShakeBootReceiver"
        private const val PREFS_NAME = "pocketwise_shake_prefs"
        private const val KEY_SERVICE_ENABLED = "is_shake_enabled"
    }
}
`;

      fs.writeFileSync(path.join(shakeDir, 'ShakeDetector.kt'), shakeDetectorContent);
      fs.writeFileSync(path.join(shakeDir, 'ShakeDetectionService.kt'), shakeServiceContent);
      fs.writeFileSync(path.join(shakeDir, 'PocketWiseShakeModule.kt'), shakeModuleContent);
      fs.writeFileSync(path.join(shakeDir, 'PocketWiseShakePackage.kt'), shakePackageContent);
      fs.writeFileSync(path.join(shakeDir, 'ShakeBootReceiver.kt'), shakeBootReceiverContent);

      // 2f. Ensure MainApplication.kt registers PocketWiseShakePackage
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
          if (appContent.includes('PackageList(this).packages.apply {')) {
            appContent = appContent.replace(
              'PackageList(this).packages.apply {',
              'PackageList(this).packages.apply {\n              add(com.pocketwise.app.shake.PocketWiseShakePackage())'
            );
          } else if (appContent.includes('PackageList(this).packages')) {
            appContent = appContent.replace(
              'PackageList(this).packages',
              'PackageList(this).packages.apply {\n              add(com.pocketwise.app.shake.PocketWiseShakePackage())\n            }'
            );
          }
          fs.writeFileSync(mainAppPath, appContent);
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidShakeDetector;
