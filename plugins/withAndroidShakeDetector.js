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
    AndroidConfig.Permissions.addPermission(androidManifest, 'android.permission.WAKE_LOCK');

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
          'android:stopWithTask': 'false',
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
    } else {
      serviceObj.$['android:stopWithTask'] = 'false';
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
          'android:taskAffinity': 'com.pocketwise.app.quickexpense',
          'android:launchMode': 'singleInstance',
          'android:theme': '@style/Theme.PocketWise.QuickExpenseDialog',
          'android:windowSoftInputMode': 'stateVisible|adjustResize',
        },
      };
      mainApplication.activity.push(activityObj);
    } else {
      activityObj.$['android:taskAffinity'] = 'com.pocketwise.app.quickexpense';
      delete activityObj.$['android:noHistory'];
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

import android.content.Context
import android.content.SharedPreferences
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
 * - Thread-safe active state suppression with auto-timeout safeguard when a popup is displayed.
 * - Complete telemetry instrumentation tracking sensor events, threshold crossings, peaks, and confirmed shakes.
 */
class ShakeDetector(
    private val appContext: Context? = null,
    private val onShakeListener: (String) -> Unit
) : SensorEventListener {

    var sensitivity: Sensitivity = Sensitivity.NORMAL

    // Gravity components isolated via low-pass filter
    private var gravityX = 0f
    private var gravityY = 0f
    private var gravityZ = 0f
    private var isGravityInitialized = false

    private var lastShakeTimestamp: Long = 0
    private var lastPeakTimestamp: Long = 0
    private val peakTimestamps = mutableListOf<Long>()
    private var unpersistedEventCount = 0
    private var prevEventTimestamp: Long = 0L

    enum class Sensitivity(
        val linearThreshold: Float,  // m/s^2 linear acceleration (gravity removed)
        val gForceThreshold: Float   // total G-force threshold
    ) {
        LOW(12.0f, 1.90f),     // Requires a firmer, deliberate shake
        NORMAL(8.0f, 1.50f),   // Standard intentional shake (balanced)
        HIGH(5.5f, 1.25f)      // Lighter shake
    }

    init {
        appContext?.let { ctx ->
            loadPersistedTelemetry(ctx)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) {
            return
        }

        val now = System.currentTimeMillis()
        totalSensorEvents++
        unpersistedEventCount++
        
        // Log every 50,000 events to show liveness but avoid spam
        if (totalSensorEvents % 50000L == 0L) {
            Log.d(TAG, "[SHAKE-1] Sensor actively receiving events. Count: \$totalSensorEvents")
        }

        // Timing & Frequency telemetry
        if (prevEventTimestamp > 0L) {
            val delta = now - prevEventTimestamp
            lastEventDeltaMs = delta
            if (delta > maxEventDeltaMs && totalSensorEvents > 10) {
                maxEventDeltaMs = delta
            }
        }
        prevEventTimestamp = now
        lastSensorEventTimeMs = now

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

        lastLinearMagnitude = linearMagnitude
        if (linearMagnitude > maxLinearMagnitude) {
            maxLinearMagnitude = linearMagnitude
        }

        lastGForce = gForce
        if (gForce > maxGForce) {
            maxGForce = gForce
        }

        val currentSensitivity = sensitivity

        // Check if motion threshold is exceeded
        val isThresholdExceeded = linearMagnitude >= currentSensitivity.linearThreshold ||
                gForce >= currentSensitivity.gForceThreshold

        if (isThresholdExceeded) {
            totalThresholdCrossings++

            // Require at least MIN_PEAK_INTERVAL_MS between recorded peaks to count distinct motion strokes
            if (now - lastPeakTimestamp >= MIN_PEAK_INTERVAL_MS) {
                lastPeakTimestamp = now
                peakTimestamps.add(now)
                totalPeaksDetected++
            }

            // Prune peaks outside the sliding temporal window
            peakTimestamps.removeAll { now - it > PEAK_WINDOW_MS }

            // Require at least REQUIRED_PEAKS distinct motion strokes within the sliding window
            if (peakTimestamps.size >= REQUIRED_PEAKS) {
                // If a popup or expense flow is already active on screen, ignore motion trigger
                if (!isPopupCurrentlyActive()) {
                    if (lastShakeTimestamp == 0L || now - lastShakeTimestamp >= COOLDOWN_MS) {
                        lastShakeTimestamp = now
                        lastDetectedShakeTimeMs = now
                        totalConfirmedShakes++
                        peakTimestamps.clear()
                        lastPeakTimestamp = 0L

                        if (appContext != null) {
                            flushTelemetry(appContext)
                        }

                        val eventId = java.util.UUID.randomUUID().toString()
                        Log.d(TAG, "[SHAKE-2] Intentional shake confirmed! Linear: \$linearMagnitude m/s^2, G-Force: \${gForce}g, Shakes: \$totalConfirmedShakes, EventId: \$eventId")
                        
                        try {
                            Log.d(TAG, "[SHAKE-3] onShakeListener entered for EventId: \$eventId")
                            onShakeListener(eventId)
                        } catch (e: Throwable) {
                            Log.e(TAG, "[SHAKE-FATAL] Uncaught exception in onShakeListener for EventId: \$eventId", e)
                        }
                    }
                }
            }
        }

        // Flush telemetry periodically every 50 events
        if (unpersistedEventCount >= 50 && appContext != null) {
            flushTelemetry(appContext)
            unpersistedEventCount = 0
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op for accelerometer accuracy changes
    }

    companion object {
        private const val TAG = "ShakeDetector"
        private const val PREFS_NAME = "pocketwise_shake_prefs"

        private const val KEY_TOTAL_EVENTS = "diag_total_sensor_events"
        private const val KEY_LAST_EVENT_MS = "diag_last_sensor_event_ms"
        private const val KEY_LAST_SHAKE_MS = "diag_last_shake_detected_ms"
        private const val KEY_TOTAL_SHAKES = "diag_total_shakes_count"
        private const val KEY_THRESHOLD_CROSSINGS = "diag_threshold_crossings"
        private const val KEY_PEAKS_DETECTED = "diag_peaks_detected"
        private const val KEY_MAX_LINEAR = "diag_max_linear_magnitude"
        private const val KEY_MAX_GFORCE = "diag_max_gforce"
        private const val KEY_MAX_DELTA_MS = "diag_max_event_delta_ms"

        private const val ALPHA = 0.85f // Low-pass filter factor for gravity estimation
        private const val MIN_PEAK_INTERVAL_MS = 80L // Minimum separation between distinct shake strokes
        private const val PEAK_WINDOW_MS = 650L // Sliding window to accumulate shake peaks
        private const val REQUIRED_PEAKS = 2 // Number of distinct strokes required to confirm shake
        private const val COOLDOWN_MS = 2500L // Debounce cooldown after shake trigger
        private const val POPUP_LOCK_TIMEOUT_MS = 15000L // Safeguard timeout against stale locks

        // Telemetry counters
        @Volatile var totalSensorEvents: Long = 0L
        @Volatile var totalThresholdCrossings: Long = 0L
        @Volatile var totalPeaksDetected: Long = 0L
        @Volatile var totalConfirmedShakes: Long = 0L
        @Volatile var lastSensorEventTimeMs: Long = 0L
        @Volatile var lastDetectedShakeTimeMs: Long = 0L
        @Volatile var lastLinearMagnitude: Float = 0f
        @Volatile var maxLinearMagnitude: Float = 0f
        @Volatile var lastGForce: Float = 0f
        @Volatile var maxGForce: Float = 0f
        @Volatile var lastEventDeltaMs: Long = 0L
        @Volatile var maxEventDeltaMs: Long = 0L

        @Volatile
        var isPopupActive: Boolean = false
            set(value) {
                field = value
                if (value) {
                    popupActiveTimestamp = System.currentTimeMillis()
                }
            }

        @Volatile
        private var popupActiveTimestamp: Long = 0

        /**
         * Load persisted telemetry from SharedPreferences on initialization.
         */
        fun loadPersistedTelemetry(context: Context) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val pEvents = prefs.getLong(KEY_TOTAL_EVENTS, 0L)
                val pCrossings = prefs.getLong(KEY_THRESHOLD_CROSSINGS, 0L)
                val pPeaks = prefs.getLong(KEY_PEAKS_DETECTED, 0L)
                val pShakes = prefs.getLong(KEY_TOTAL_SHAKES, 0L)
                val pLastEvent = prefs.getLong(KEY_LAST_EVENT_MS, 0L)
                val pLastShake = prefs.getLong(KEY_LAST_SHAKE_MS, 0L)
                val pMaxLinear = prefs.getFloat(KEY_MAX_LINEAR, 0f)
                val pMaxGForce = prefs.getFloat(KEY_MAX_GFORCE, 0f)
                val pMaxDelta = prefs.getLong(KEY_MAX_DELTA_MS, 0L)

                if (pEvents > totalSensorEvents) totalSensorEvents = pEvents
                if (pCrossings > totalThresholdCrossings) totalThresholdCrossings = pCrossings
                if (pPeaks > totalPeaksDetected) totalPeaksDetected = pPeaks
                if (pShakes > totalConfirmedShakes) totalConfirmedShakes = pShakes
                if (pLastEvent > lastSensorEventTimeMs) lastSensorEventTimeMs = pLastEvent
                if (pLastShake > lastDetectedShakeTimeMs) lastDetectedShakeTimeMs = pLastShake
                if (pMaxLinear > maxLinearMagnitude) maxLinearMagnitude = pMaxLinear
                if (pMaxGForce > maxGForce) maxGForce = pMaxGForce
                if (pMaxDelta > maxEventDeltaMs) maxEventDeltaMs = pMaxDelta
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load persisted telemetry", e)
            }
        }

        /**
         * Persist current telemetry to SharedPreferences.
         */
        fun flushTelemetry(context: Context) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().apply {
                    putLong(KEY_TOTAL_EVENTS, totalSensorEvents)
                    putLong(KEY_THRESHOLD_CROSSINGS, totalThresholdCrossings)
                    putLong(KEY_PEAKS_DETECTED, totalPeaksDetected)
                    putLong(KEY_TOTAL_SHAKES, totalConfirmedShakes)
                    putLong(KEY_LAST_EVENT_MS, lastSensorEventTimeMs)
                    putLong(KEY_LAST_SHAKE_MS, lastDetectedShakeTimeMs)
                    putFloat(KEY_MAX_LINEAR, maxLinearMagnitude)
                    putFloat(KEY_MAX_GFORCE, maxGForce)
                    putLong(KEY_MAX_DELTA_MS, maxEventDeltaMs)
                }.apply()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to flush telemetry to SharedPreferences", e)
            }
        }

        /**
         * Safely check if a popup is actively blocking shake triggers,
         * with an automatic timeout fallback to ensure repeatable detection.
         */
        fun isPopupCurrentlyActive(): Boolean {
            if (!isPopupActive) return false
            if (System.currentTimeMillis() - popupActiveTimestamp > POPUP_LOCK_TIMEOUT_MS) {
                Log.w(TAG, "isPopupActive lock timed out after \${POPUP_LOCK_TIMEOUT_MS}ms. Auto-resetting lock.")
                isPopupActive = false
                return false
            }
            return true
        }
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
import android.os.*
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import com.pocketwise.app.R
import java.util.UUID

class ShakeDetectionService : Service() {

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var shakeDetector: ShakeDetector? = null
    private var isListening = false

    private var sensorThread: HandlerThread? = null
    private var sensorHandler: Handler? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "ShakeDetectionService onCreate")

        // 1. Instance tracking & Start Count
        serviceInstanceId = UUID.randomUUID().toString()
        serviceStartTimestamp = System.currentTimeMillis()
        isServiceRunning = true

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val currentCount = prefs.getLong(KEY_SERVICE_START_COUNT, 0L) + 1L
        prefs.edit().apply {
            putLong(KEY_SERVICE_START_COUNT, currentCount)
            putString(KEY_SERVICE_INSTANCE_ID, serviceInstanceId)
            putLong(KEY_SERVICE_START_TIME, serviceStartTimestamp)
        }.apply()
        serviceStartCount = currentCount

        // 2. Foreground Notification
        createNotificationChannel()
        startForegroundServiceNotification()

        // 3. Acquire background sensor WakeLock to prevent OEM CPU sleep from freezing accelerometer
        acquireWakeLock()

        // 4. Start dedicated sensor HandlerThread
        initSensorThread()

        // 5. Initialize detector and start listening
        initShakeDetector()
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PocketWise:ShakeSensorWakeLock")?.apply {
                setReferenceCounted(false)
                acquire(24 * 60 * 60 * 1000L) // 24hr safety timeout
            }
            Log.d(TAG, "Acquired PARTIAL_WAKE_LOCK for ShakeDetectionService")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to acquire PARTIAL_WAKE_LOCK", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "Released PARTIAL_WAKE_LOCK")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing wakeLock", e)
        }
    }

    private fun initSensorThread() {
        try {
            if (sensorThread == null || !sensorThread!!.isAlive) {
                sensorThread = HandlerThread("PocketWiseShakeSensorThread", Process.THREAD_PRIORITY_MORE_FAVORABLE).apply {
                    start()
                }
                sensorHandler = Handler(sensorThread!!.looper)
                Log.d(TAG, "Initialized dedicated HandlerThread for sensor events")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize sensor HandlerThread, defaulting to main looper", e)
            sensorHandler = Handler(Looper.getMainLooper())
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.d(TAG, "ShakeDetectionService onStartCommand action=\$action, startId=\$startId, instance=\$serviceInstanceId")

        when (action) {
            ACTION_STOP -> {
                Log.d(TAG, "Stopping ShakeDetectionService by intent request")
                stopListening()
                releaseWakeLock()
                stopForeground(true)
                stopSelf()
                isServiceRunning = false
                return START_NOT_STICKY
            }
            ACTION_UPDATE_SENSITIVITY -> {
                val sensStr = intent?.getStringExtra("sensitivity") ?: "NORMAL"
                val sens = try {
                    ShakeDetector.Sensitivity.valueOf(sensStr)
                } catch (e: Exception) {
                    ShakeDetector.Sensitivity.NORMAL
                }
                shakeDetector?.sensitivity = sens
                Log.d(TAG, "Updated shake detector sensitivity to: \$sens")
            }
            ACTION_SET_BACKGROUND_ENABLED -> {
                val bgEnabled = intent?.getBooleanExtra("backgroundEnabled", true) ?: true
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putBoolean(KEY_BACKGROUND_ENABLED, bgEnabled).apply()
                Log.d(TAG, "Updated background shake detection preference to: \$bgEnabled")
            }
            else -> {
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val isServiceEnabled = prefs.getBoolean(KEY_SERVICE_ENABLED, true)
                if (isServiceEnabled) {
                    startListening(force = true)
                } else {
                    stopListening()
                    stopSelf()
                }
            }
        }

        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "ShakeDetectionService onTaskRemoved - App swiped away from Recents (instance=\$serviceInstanceId)")

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isServiceEnabled = prefs.getBoolean(KEY_SERVICE_ENABLED, true)
        val isBgEnabled = prefs.getBoolean(KEY_BACKGROUND_ENABLED, true)

        if (isServiceEnabled && isBgEnabled) {
            Log.d(TAG, "Background Shake Detection is enabled; re-verifying sensor listener registration across task removal")
            acquireWakeLock()
            initSensorThread()
            startListening(force = true)

            // Alarm fallback if process is killed
            try {
                val restartIntent = Intent(applicationContext, ShakeDetectionService::class.java).apply {
                    action = ACTION_START
                }
                val pendingIntent = PendingIntent.getForegroundService(
                    applicationContext,
                    RESTART_ALARM_REQUEST_CODE,
                    restartIntent,
                    PendingIntent.FLAG_ONE_SHOT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
                val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                alarmManager?.set(
                    AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 1000,
                    pendingIntent
                )
            } catch (e: Exception) {
                Log.w(TAG, "Could not schedule alarm restart fallback", e)
            }
        } else {
            Log.d(TAG, "Shake detection disabled by preferences; stopping service on task removal")
            stopListening()
            stopSelf()
        }
    }

    private fun initShakeDetector() {
        sensorManager = applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        isSensorAvailable = accelerometer != null
        sensorName = accelerometer?.name ?: "Unknown"
        sensorVendor = accelerometer?.vendor ?: "Unknown"
        sensorType = accelerometer?.type ?: -1

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val sensStr = prefs.getString(KEY_SENSITIVITY, "NORMAL") ?: "NORMAL"
        val initialSensitivity = try {
            ShakeDetector.Sensitivity.valueOf(sensStr)
        } catch (e: Exception) {
            ShakeDetector.Sensitivity.NORMAL
        }

        shakeDetector = ShakeDetector(applicationContext) { eventId ->
            handleShakeTriggered(eventId)
        }.apply {
            sensitivity = initialSensitivity
        }
        isDetectorActive = true
    }

    private fun startListening(force: Boolean = false) {
        if (accelerometer == null || sensorManager == null) {
            sensorManager = applicationContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
            isSensorAvailable = accelerometer != null
            sensorName = accelerometer?.name ?: "Unknown"
            sensorVendor = accelerometer?.vendor ?: "Unknown"
            sensorType = accelerometer?.type ?: -1
        }

        if (shakeDetector == null) {
            initShakeDetector()
        }

        initSensorThread()

        if (accelerometer == null) {
            Log.w(TAG, "Accelerometer hardware sensor not available on this device")
            isSensorAvailable = false
            isSensorListening = false
            return
        }

        if (force && isListening) {
            try {
                sensorManager?.unregisterListener(shakeDetector)
            } catch (e: Exception) {
                Log.w(TAG, "Error unregistering before force re-registration", e)
            }
            isListening = false
        }

        if (isListening) return

        sensorRegistrationTimestamp = System.currentTimeMillis()
        val handler = sensorHandler ?: Handler(Looper.getMainLooper())

        val registered = sensorManager?.registerListener(
            shakeDetector,
            accelerometer,
            SensorManager.SENSOR_DELAY_GAME,
            handler
        ) ?: false

        sensorRegistrationResult = registered
        isListening = registered
        isServiceRunning = true
        isSensorListening = registered
        isDetectorActive = true

        // Persist sensor registration state
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putLong(KEY_REGISTRATION_TIME, sensorRegistrationTimestamp)
            putBoolean(KEY_REGISTRATION_RESULT, sensorRegistrationResult)
            putString(KEY_SENSOR_NAME, sensorName)
            putString(KEY_SENSOR_VENDOR, sensorVendor)
        }.apply()

        Log.d(TAG, "ShakeDetectionService registerListener result: \$registered (SENSOR_DELAY_GAME, force=\$force, handler=\${handler.looper.thread.name})")
    }

    private fun stopListening() {
        if (!isListening) return

        try {
            sensorManager?.unregisterListener(shakeDetector)
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering sensor listener", e)
        }
        isListening = false
        isSensorListening = false
        Log.d(TAG, "ShakeDetectionService stopped listening on accelerometer")
    }

    private fun handleShakeTriggered(eventId: String) {
        try {
            Log.d(TAG, "[SHAKE-4] handleShakeTriggered entered from ShakeDetectionService (instance=\$serviceInstanceId), EventId: \$eventId")

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val bgCallbacks = prefs.getLong(KEY_BG_SHAKE_CALLBACKS, 0L) + 1L
            prefs.edit().putLong(KEY_BG_SHAKE_CALLBACKS, bgCallbacks).apply()

            // Flush telemetry immediately on shake
            ShakeDetector.flushTelemetry(applicationContext)

            // 1. Check if PocketWise is actively RESUMED in foreground
            Log.d(TAG, "[SHAKE-5] Checking foreground state. EventId: \$eventId")
            val isForeground = PocketWiseShakeModule.isAppInForeground()
            if (isForeground) {
                val emittedToRN = PocketWiseShakeModule.emitShakeDetected()
                if (emittedToRN) {
                    Log.d(TAG, "Foreground shake successfully handled by React Native modal. EventId: \$eventId")
                    return
                }
            }

            // 2. Direct Background Path: Native QuickExpenseActivity
            val isBackgroundAllowed = prefs.getBoolean(KEY_BACKGROUND_ENABLED, true)
            if (!isBackgroundAllowed) {
                Log.d(TAG, "Background shake detection disabled by user preference. EventId: \$eventId")
                return
            }

            // Verify sensor listening state
            startListening(force = false)

            val canOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(this)
            } else {
                true
            }

            Log.d(TAG, "[SHAKE-6] Background route selected. Overlay: \$canOverlay, EventId: \$eventId")

            val launchAttempts = prefs.getLong(KEY_POPUP_LAUNCH_ATTEMPTS, 0L) + 1L
            val now = System.currentTimeMillis()
            prefs.edit().apply {
                putLong(KEY_POPUP_LAUNCH_ATTEMPTS, launchAttempts)
                putLong(KEY_LAST_POPUP_LAUNCH_ATTEMPT, now)
            }.apply()

            Log.d(TAG, "[SHAKE-7] Attempting Activity Launch. EventId: \$eventId")
            if (canOverlay) {
                try {
                    val popupIntent = Intent(this, QuickExpenseActivity::class.java).apply {
                        addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP
                        )
                    }

                    val options = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        ActivityOptions.makeBasic().apply {
                            setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
                        }.toBundle()
                    } else {
                        null
                    }

                    if (options != null) {
                        startActivity(popupIntent, options)
                    } else {
                        startActivity(popupIntent)
                    }

                    val successes = prefs.getLong(KEY_POPUP_LAUNCH_SUCCESSES, 0L) + 1L
                    prefs.edit().apply {
                        putLong(KEY_POPUP_LAUNCH_SUCCESSES, successes)
                        putLong(KEY_LAST_POPUP_LAUNCH_SUCCESS, now)
                        putString(KEY_LAST_POPUP_LAUNCH_ERROR, "None")
                    }.apply()
                    Log.d(TAG, "Successfully launched QuickExpenseActivity from background shake")
                } catch (e: Throwable) {
                    Log.e(TAG, "[SHAKE-FATAL] Failed to launch QuickExpenseActivity directly. EventId: \$eventId", e)
                    val failures = prefs.getLong(KEY_POPUP_LAUNCH_FAILURES, 0L) + 1L
                    val errorMsg = "\${e.javaClass.simpleName}: \${e.message ?: "Unknown error"}"
                    prefs.edit().apply {
                        putLong(KEY_POPUP_LAUNCH_FAILURES, failures)
                        putString(KEY_LAST_POPUP_LAUNCH_ERROR, errorMsg)
                    }.apply()
                    showQuickExpenseNotification()
                }
            } else {
                Log.w(TAG, "Overlay permission not granted; falling back to high-priority notification. EventId: \$eventId")
                val failures = prefs.getLong(KEY_POPUP_LAUNCH_FAILURES, 0L) + 1L
                prefs.edit().apply {
                    putLong(KEY_POPUP_LAUNCH_FAILURES, failures)
                    putString(KEY_LAST_POPUP_LAUNCH_ERROR, "Overlay permission (SYSTEM_ALERT_WINDOW) not granted")
                }.apply()
                showQuickExpenseNotification()
            }
        } catch (e: Throwable) {
            Log.e(TAG, "[SHAKE-FATAL] Uncaught exception in handleShakeTriggered for EventId: \$eventId", e)
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
        releaseWakeLock()

        try {
            sensorThread?.quitSafely()
        } catch (e: Exception) {
            // Ignore
        }
        sensorThread = null
        sensorHandler = null

        ShakeDetector.flushTelemetry(applicationContext)
        ShakeDetector.isPopupActive = false
        isServiceRunning = false
        isSensorListening = false
        isDetectorActive = false
        Log.d(TAG, "ShakeDetectionService destroyed (instance=\$serviceInstanceId)")
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
        private const val RESTART_ALARM_REQUEST_CODE = 4001

        private const val PREFS_NAME = "pocketwise_shake_prefs"
        private const val KEY_SERVICE_ENABLED = "is_shake_enabled"
        private const val KEY_SENSITIVITY = "shake_sensitivity"
        private const val KEY_BACKGROUND_ENABLED = "is_background_enabled"
        private const val KEY_SERVICE_START_COUNT = "diag_service_start_count"
        private const val KEY_SERVICE_INSTANCE_ID = "diag_service_instance_id"
        private const val KEY_SERVICE_START_TIME = "diag_service_start_time"
        private const val KEY_REGISTRATION_TIME = "diag_sensor_reg_time"
        private const val KEY_REGISTRATION_RESULT = "diag_sensor_reg_result"
        private const val KEY_SENSOR_NAME = "diag_sensor_name"
        private const val KEY_SENSOR_VENDOR = "diag_sensor_vendor"
        private const val KEY_BG_SHAKE_CALLBACKS = "diag_bg_shake_callbacks"
        private const val KEY_POPUP_LAUNCH_ATTEMPTS = "diag_popup_launch_attempts"
        private const val KEY_POPUP_LAUNCH_SUCCESSES = "diag_popup_launch_successes"
        private const val KEY_POPUP_LAUNCH_FAILURES = "diag_popup_launch_failures"
        private const val KEY_LAST_POPUP_LAUNCH_ATTEMPT = "diag_last_popup_launch_attempt_ms"
        private const val KEY_LAST_POPUP_LAUNCH_SUCCESS = "diag_last_popup_launch_success_ms"
        private const val KEY_LAST_POPUP_LAUNCH_ERROR = "diag_last_popup_launch_error"

        @Volatile
        var serviceInstanceId: String = ""

        @Volatile
        var serviceStartCount: Long = 0L

        @Volatile
        var serviceStartTimestamp: Long = 0L

        @Volatile
        var isServiceRunning: Boolean = false

        @Volatile
        var isSensorAvailable: Boolean = false

        @Volatile
        var sensorName: String = "Unknown"

        @Volatile
        var sensorVendor: String = "Unknown"

        @Volatile
        var sensorType: Int = -1

        @Volatile
        var sensorRegistrationTimestamp: Long = 0L

        @Volatile
        var sensorRegistrationResult: Boolean = false

        @Volatile
        var isSensorListening: Boolean = false

        @Volatile
        var isDetectorActive: Boolean = false
    }
}
`;

      // 2c. PocketWiseShakeModule.kt
      const shakeModuleContent = `package com.pocketwise.app.shake

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

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
    fun getServiceDiagnostics(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isEnabled = prefs.getBoolean(KEY_SERVICE_ENABLED, true)
            val isBgEnabled = prefs.getBoolean(KEY_BACKGROUND_ENABLED, true)
            val sensitivityStr = prefs.getString(KEY_SENSITIVITY, "NORMAL") ?: "NORMAL"
            val sensEnum = try {
                ShakeDetector.Sensitivity.valueOf(sensitivityStr)
            } catch (e: Exception) {
                ShakeDetector.Sensitivity.NORMAL
            }

            // Persisted counters
            val pEvents = prefs.getLong("diag_total_sensor_events", 0L)
            val pCrossings = prefs.getLong("diag_threshold_crossings", 0L)
            val pPeaks = prefs.getLong("diag_peaks_detected", 0L)
            val pShakes = prefs.getLong("diag_total_shakes_count", 0L)
            val pLastEvent = prefs.getLong("diag_last_sensor_event_ms", 0L)
            val pLastShake = prefs.getLong("diag_last_shake_detected_ms", 0L)
            val pMaxLinear = prefs.getFloat("diag_max_linear_magnitude", 0f)
            val pMaxGForce = prefs.getFloat("diag_max_gforce", 0f)
            val pMaxDelta = prefs.getLong("diag_max_event_delta_ms", 0L)

            val startCount = prefs.getLong("diag_service_start_count", ShakeDetectionService.serviceStartCount)
            val instanceId = prefs.getString("diag_service_instance_id", ShakeDetectionService.serviceInstanceId) ?: ""
            val startTime = prefs.getLong("diag_service_start_time", ShakeDetectionService.serviceStartTimestamp)
            val regTime = prefs.getLong("diag_sensor_reg_time", ShakeDetectionService.sensorRegistrationTimestamp)
            val regResult = prefs.getBoolean("diag_sensor_reg_result", ShakeDetectionService.sensorRegistrationResult)
            val sName = prefs.getString("diag_sensor_name", ShakeDetectionService.sensorName) ?: ShakeDetectionService.sensorName
            val sVendor = prefs.getString("diag_sensor_vendor", ShakeDetectionService.sensorVendor) ?: ShakeDetectionService.sensorVendor

            // Combine live and persisted counts
            val totalEvents = Math.max(pEvents, ShakeDetector.totalSensorEvents)
            val totalCrossings = Math.max(pCrossings, ShakeDetector.totalThresholdCrossings)
            val totalPeaks = Math.max(pPeaks, ShakeDetector.totalPeaksDetected)
            val totalShakes = Math.max(pShakes, ShakeDetector.totalConfirmedShakes)
            val lastEvent = Math.max(pLastEvent, ShakeDetector.lastSensorEventTimeMs)
            val lastShake = Math.max(pLastShake, ShakeDetector.lastDetectedShakeTimeMs)
            val maxLinear = Math.max(pMaxLinear, ShakeDetector.maxLinearMagnitude)
            val maxG = Math.max(pMaxGForce, ShakeDetector.maxGForce)
            val maxDelta = Math.max(pMaxDelta, ShakeDetector.maxEventDeltaMs)

            // Background popup & lifecycle telemetry counters
            val bgCallbacks = prefs.getLong("diag_bg_shake_callbacks", 0L)
            val launchAttempts = prefs.getLong("diag_popup_launch_attempts", 0L)
            val launchSuccesses = prefs.getLong("diag_popup_launch_successes", 0L)
            val launchFailures = prefs.getLong("diag_popup_launch_failures", 0L)
            val lastLaunchAttempt = prefs.getLong("diag_last_popup_launch_attempt_ms", 0L)
            val lastLaunchSuccess = prefs.getLong("diag_last_popup_launch_success_ms", 0L)
            val lastLaunchError = prefs.getString("diag_last_popup_launch_error", "None") ?: "None"

            val popupOnCreate = prefs.getLong("diag_popup_on_create_count", 0L)
            val popupOnStart = prefs.getLong("diag_popup_on_start_count", 0L)
            val popupOnResume = prefs.getLong("diag_popup_on_resume_count", 0L)
            val popupOnPause = prefs.getLong("diag_popup_on_pause_count", 0L)
            val popupOnStop = prefs.getLong("diag_popup_on_stop_count", 0L)
            val popupOnDestroy = prefs.getLong("diag_popup_on_destroy_count", 0L)
            val lastPopupCreateMs = prefs.getLong("diag_last_popup_on_create_ms", 0L)
            val lastPopupResumeMs = prefs.getLong("diag_last_popup_on_resume_ms", 0L)
            val lastPopupDestroyMs = prefs.getLong("diag_last_popup_on_destroy_ms", 0L)

            val map = Arguments.createMap().apply {
                putBoolean("serviceRunning", ShakeDetectionService.isServiceRunning)
                putBoolean("sensorAvailable", ShakeDetectionService.isSensorAvailable)
                putBoolean("sensorListening", ShakeDetectionService.isSensorListening)
                putBoolean("detectorActive", ShakeDetectionService.isDetectorActive)
                putBoolean("serviceEnabled", isEnabled)
                putBoolean("backgroundEnabled", isBgEnabled)
                putString("sensitivity", sensitivityStr)
                putDouble("linearThreshold", sensEnum.linearThreshold.toDouble())
                putDouble("gForceThreshold", sensEnum.gForceThreshold.toDouble())
                putDouble("sensorEventsReceived", totalEvents.toDouble())
                putDouble("thresholdCrossings", totalCrossings.toDouble())
                putDouble("peaksDetected", totalPeaks.toDouble())
                putDouble("confirmedShakes", totalShakes.toDouble())
                putDouble("lastLinearMagnitude", ShakeDetector.lastLinearMagnitude.toDouble())
                putDouble("maxLinearMagnitude", maxLinear.toDouble())
                putDouble("lastGForce", ShakeDetector.lastGForce.toDouble())
                putDouble("maxGForce", maxG.toDouble())
                putDouble("lastSensorEventTimestamp", lastEvent.toDouble())
                putDouble("lastShakeTimestamp", lastShake.toDouble())
                putDouble("lastEventDeltaMs", ShakeDetector.lastEventDeltaMs.toDouble())
                putDouble("maxEventDeltaMs", maxDelta.toDouble())
                putBoolean("popupActive", ShakeDetector.isPopupActive)
                putString("serviceInstanceId", instanceId)
                putDouble("serviceStartCount", startCount.toDouble())
                putDouble("serviceStartTimestamp", startTime.toDouble())
                putDouble("sensorRegistrationTimestamp", regTime.toDouble())
                putBoolean("sensorRegistrationResult", regResult)
                putString("sensorName", sName)
                putString("sensorVendor", sVendor)
                // Persistent Background Popup & Lifecycle Telemetry
                putDouble("backgroundShakeCallbacks", bgCallbacks.toDouble())
                putDouble("popupLaunchAttempts", launchAttempts.toDouble())
                putDouble("popupLaunchSuccesses", launchSuccesses.toDouble())
                putDouble("popupLaunchFailures", launchFailures.toDouble())
                putDouble("lastPopupLaunchAttempt", lastLaunchAttempt.toDouble())
                putDouble("lastPopupLaunchSuccess", lastLaunchSuccess.toDouble())
                putString("lastPopupLaunchError", lastLaunchError)
                putDouble("popupOnCreate", popupOnCreate.toDouble())
                putDouble("popupOnStart", popupOnStart.toDouble())
                putDouble("popupOnResume", popupOnResume.toDouble())
                putDouble("popupOnPause", popupOnPause.toDouble())
                putDouble("popupOnStop", popupOnStop.toDouble())
                putDouble("popupOnDestroy", popupOnDestroy.toDouble())
                putDouble("lastPopupOnCreateTimestamp", lastPopupCreateMs.toDouble())
                putDouble("lastPopupOnResumeTimestamp", lastPopupResumeMs.toDouble())
                putDouble("lastPopupOnDestroyTimestamp", lastPopupDestroyMs.toDouble())
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("DIAGNOSTICS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun runSensorSelfTest(durationMs: Double, promise: Promise) {
        val testDuration = durationMs.toLong().coerceIn(1000L, 5000L)

        Thread {
            try {
                val sensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
                val accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

                if (sensorManager == null || accelerometer == null) {
                    val res = Arguments.createMap().apply {
                        putInt("eventsReceived", 0)
                        putDouble("durationMs", testDuration.toDouble())
                        putBoolean("sensorAvailable", false)
                        putString("sensorName", "None")
                        putString("sensorVendor", "None")
                        putBoolean("registrationSuccess", false)
                        putDouble("lastEventTimeMs", 0.0)
                    }
                    promise.resolve(res)
                    return@Thread
                }

                val eventsReceived = AtomicInteger(0)
                val lastEventTime = AtomicLong(0L)

                val testThread = HandlerThread("PocketWiseSensorSelfTestThread").apply { start() }
                val testHandler = Handler(testThread.looper)
                val latch = CountDownLatch(1)

                val testListener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent?) {
                        if (event?.sensor?.type == Sensor.TYPE_ACCELEROMETER) {
                            eventsReceived.incrementAndGet()
                            lastEventTime.set(System.currentTimeMillis())
                        }
                    }

                    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
                }

                val regSuccess = sensorManager.registerListener(
                    testListener,
                    accelerometer,
                    SensorManager.SENSOR_DELAY_GAME,
                    testHandler
                )

                latch.await(testDuration, TimeUnit.MILLISECONDS)

                sensorManager.unregisterListener(testListener)
                testThread.quitSafely()

                val res = Arguments.createMap().apply {
                    putInt("eventsReceived", eventsReceived.get())
                    putDouble("durationMs", testDuration.toDouble())
                    putBoolean("sensorAvailable", true)
                    putString("sensorName", accelerometer.name)
                    putString("sensorVendor", accelerometer.vendor)
                    putBoolean("registrationSuccess", regSuccess)
                    putDouble("lastEventTimeMs", lastEventTime.get().toDouble())
                }
                promise.resolve(res)
            } catch (e: Exception) {
                promise.reject("SELF_TEST_ERROR", e.message, e)
            }
        }.start()
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

        @Volatile
        var isMainActivityResumed: Boolean = false

        @Volatile
        var isAppForeground: Boolean = false

        fun getReactContext(): ReactApplicationContext? = companionReactContext

        fun isAppInForeground(): Boolean {
            val context = companionReactContext
            if (!isMainActivityResumed || !isAppForeground) {
                return false
            }
            if (context == null || !context.hasActiveReactInstance()) {
                return false
            }
            val act = context.currentActivity
            if (act == null || act !is com.pocketwise.app.MainActivity || act.isFinishing) {
                return false
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && act.isDestroyed) {
                return false
            }
            return true
        }

        fun emitShakeDetected(): Boolean {
            if (!isAppInForeground()) {
                return false
            }
            val context = companionReactContext
            if (context != null && context.hasActiveReactInstance()) {
                try {
                    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onShakeDetected", null)
                    Log.d(TAG, "Emitted onShakeDetected event to foreground React Native instance")
                    return true
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to emit onShakeDetected", e)
                    return false
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

      // 2e. QuickExpenseActivity.kt
      const quickExpenseActivityContent = `package com.pocketwise.app.shake

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.pocketwise.app.R
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors

class QuickExpenseActivity : AppCompatActivity() {

    private lateinit var etAmount: EditText
    private lateinit var etDescription: EditText
    private lateinit var spAccount: Spinner
    private lateinit var spCategory: Spinner
    private lateinit var btnDone: Button
    private lateinit var btnClose: TextView
    private lateinit var pbLoading: ProgressBar
    private lateinit var tvError: TextView
    private lateinit var rootContainer: FrameLayout

    private val executor = Executors.newSingleThreadExecutor()
    private var isSubmitting = false

    private val accountList = mutableListOf<AccountItem>()
    private val categoryList = mutableListOf<CategoryItem>()

    data class AccountItem(val id: String, val name: String, val balance: Long)
    data class CategoryItem(val id: String, val name: String)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "[SHAKE-8] QuickExpenseActivity onCreate called")
        incrementLifecycleCount(KEY_POPUP_ON_CREATE, KEY_LAST_POPUP_ON_CREATE_MS)
        ShakeDetector.isPopupActive = true

        // Ensure window displays even if device is locked or screen was dimmed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window?.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        // Configure Dialog Window layout params for a comfortable, responsive card width (88% of screen)
        window?.let { win ->
            val displayMetrics = resources.displayMetrics
            val screenWidth = displayMetrics.widthPixels
            val density = displayMetrics.density
            val minWidthPx = (320 * density).toInt()
            val maxWidthPx = (420 * density).toInt()
            val marginPx = (32 * density).toInt()
            val targetWidth = (screenWidth * 0.88f).toInt().coerceIn(minWidthPx.coerceAtMost(screenWidth - marginPx), maxWidthPx)

            win.setLayout(targetWidth, ViewGroup.LayoutParams.WRAP_CONTENT)
            win.setGravity(Gravity.CENTER)
            win.setBackgroundDrawableResource(android.R.color.transparent)
        }

        setContentView(R.layout.activity_quick_expense)

        initViews()
        loadCachedAccountsAndCategories()
        setupListeners()

        // Auto-focus Amount field and show software keyboard
        etAmount.postDelayed({
            etAmount.requestFocus()
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            imm?.showSoftInput(etAmount, InputMethodManager.SHOW_IMPLICIT)
        }, 150)
    }

    override fun onStart() {
        super.onStart()
        Log.d(TAG, "[SHAKE-9] QuickExpenseActivity onStart called")
        incrementLifecycleCount(KEY_POPUP_ON_START, null)
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "[SHAKE-10] QuickExpenseActivity onResume called")
        incrementLifecycleCount(KEY_POPUP_ON_RESUME, KEY_LAST_POPUP_ON_RESUME_MS)
        incrementPopupLaunchSuccess()
        ShakeDetector.isPopupActive = true
    }

    override fun onPause() {
        super.onPause()
        incrementLifecycleCount(KEY_POPUP_ON_PAUSE, null)
        ShakeDetector.isPopupActive = false
    }

    override fun onStop() {
        super.onStop()
        incrementLifecycleCount(KEY_POPUP_ON_STOP, null)
        ShakeDetector.isPopupActive = false
    }

    override fun onDestroy() {
        super.onDestroy()
        incrementLifecycleCount(KEY_POPUP_ON_DESTROY, KEY_LAST_POPUP_ON_DESTROY_MS)
        ShakeDetector.isPopupActive = false
    }

    private fun initViews() {
        rootContainer = findViewById(R.id.rootContainer)
        etAmount = findViewById(R.id.etAmount)
        etDescription = findViewById(R.id.etDescription)
        spAccount = findViewById(R.id.spAccount)
        spCategory = findViewById(R.id.spCategory)
        btnDone = findViewById(R.id.btnDone)
        btnClose = findViewById(R.id.btnClose)
        pbLoading = findViewById(R.id.pbLoading)
        tvError = findViewById(R.id.tvError)
    }

    private fun loadCachedAccountsAndCategories() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        // Load Accounts
        val accountsJsonStr = prefs.getString(KEY_ACCOUNTS, "[]") ?: "[]"
        try {
            val accountsArray = JSONArray(accountsJsonStr)
            for (i in 0 until accountsArray.length()) {
                val obj = accountsArray.optJSONObject(i) ?: continue
                val id = obj.optString("id", "")
                val name = obj.optString("name", "Account")
                val balance = obj.optLong("balance", 0L)
                if (id.isNotEmpty()) {
                    accountList.add(AccountItem(id, name, balance))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse cached accounts", e)
        }

        if (accountList.isEmpty()) {
            accountList.add(AccountItem("acc_primary", "Primary Account", 0L))
        }

        val accountAdapter = object : ArrayAdapter<String>(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            accountList.map { it.name }
        ) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val v = super.getView(position, convertView, parent)
                (v as? TextView)?.apply {
                    setTextColor(Color.WHITE)
                    textSize = 14f
                    setPadding(12, 0, 12, 0)
                }
                return v
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val v = super.getDropDownView(position, convertView, parent)
                (v as? TextView)?.apply {
                    setTextColor(Color.WHITE)
                    setBackgroundColor(Color.parseColor("#27272A"))
                    textSize = 14f
                    val pad = (12 * resources.displayMetrics.density).toInt()
                    setPadding(pad, pad, pad, pad)
                }
                return v
            }
        }
        spAccount.adapter = accountAdapter

        // Load Categories
        val categoriesJsonStr = prefs.getString(KEY_CATEGORIES, "[]") ?: "[]"
        try {
            val categoriesArray = JSONArray(categoriesJsonStr)
            for (i in 0 until categoriesArray.length()) {
                val obj = categoriesArray.optJSONObject(i) ?: continue
                val id = obj.optString("id", "")
                val name = obj.optString("name", "General")
                val type = obj.optString("type", "expense")
                if (id.isNotEmpty() && (type == "expense" || type.isEmpty())) {
                    categoryList.add(CategoryItem(id, name))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse cached categories", e)
        }

        if (categoryList.isEmpty()) {
            categoryList.add(CategoryItem("cat_general", "General"))
            categoryList.add(CategoryItem("cat_fuel", "Fuel & Transport"))
            categoryList.add(CategoryItem("cat_food", "Food & Dining"))
            categoryList.add(CategoryItem("cat_groceries", "Groceries"))
            categoryList.add(CategoryItem("cat_shopping", "Shopping"))
        }

        val categoryAdapter = object : ArrayAdapter<String>(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            categoryList.map { it.name }
        ) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val v = super.getView(position, convertView, parent)
                (v as? TextView)?.apply {
                    setTextColor(Color.WHITE)
                    textSize = 14f
                    setPadding(12, 0, 12, 0)
                }
                return v
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val v = super.getDropDownView(position, convertView, parent)
                (v as? TextView)?.apply {
                    setTextColor(Color.WHITE)
                    setBackgroundColor(Color.parseColor("#27272A"))
                    textSize = 14f
                    val pad = (12 * resources.displayMetrics.density).toInt()
                    setPadding(pad, pad, pad, pad)
                }
                return v
            }
        }
        spCategory.adapter = categoryAdapter
    }

    private fun setupListeners() {
        btnClose.setOnClickListener {
            dismissPopup()
        }

        rootContainer.setOnClickListener {
            dismissPopup()
        }

        btnDone.setOnClickListener {
            handleDone()
        }
    }

    private fun handleDone() {
        if (isSubmitting) return

        val rawAmount = etAmount.text.toString().trim()
        val description = etDescription.text.toString().trim()

        // Validation
        if (rawAmount.isEmpty()) {
            showError("Please enter an amount")
            return
        }

        val cleanAmountStr = rawAmount.replace("[^0-9.]".toRegex(), "")
        val parsedDouble = cleanAmountStr.toDoubleOrNull()
        if (parsedDouble == null || parsedDouble <= 0.0) {
            showError("Amount must be greater than ₹0")
            return
        }

        if (description.isEmpty()) {
            showError("Please enter a description (e.g. Petrol)")
            return
        }

        val minorAmount = Math.round(parsedDouble * 100)
        val selectedAccount = accountList.getOrNull(spAccount.selectedItemPosition) ?: accountList[0]
        val selectedCategory = categoryList.getOrNull(spCategory.selectedItemPosition)

        val txId = UUID.randomUUID().toString()
        val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        setLoading(true)

        // Path 1: Check if React Native instance is active
        val emitted = PocketWiseShakeModule.emitExpenseSubmitted(
            id = txId,
            amountMinor = minorAmount,
            description = description,
            accountId = selectedAccount.id,
            categoryId = selectedCategory?.id,
            date = dateStr
        )

        if (emitted) {
            Log.d(TAG, "Expense submitted to active React Native bridge: ID=\$txId, Amount=\$minorAmount")
            playSuccessHaptic()
            dismissPopup()
            return
        }

        // Path 2: Background Native direct Supabase REST Fallback
        Log.d(TAG, "React Native JS runtime sleeping. Executing direct native Supabase persistence...")
        executor.execute {
            val success = persistExpenseDirectly(
                txId = txId,
                amountMinor = minorAmount,
                description = description,
                accountId = selectedAccount.id,
                categoryId = selectedCategory?.id,
                dateStr = dateStr
            )

            runOnUiThread {
                setLoading(false)
                if (success) {
                    playSuccessHaptic()
                    dismissPopup()
                } else {
                    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val userId = prefs.getString(KEY_USER_ID, "") ?: ""
                    if (userId.isEmpty()) {
                        showError("Please log in to PocketWise to record expenses.")
                    } else {
                        showError("Failed to save expense. Please retry.")
                    }
                }
            }
        }
    }

    private fun persistExpenseDirectly(
        txId: String,
        amountMinor: Long,
        description: String,
        accountId: String,
        categoryId: String?,
        dateStr: String
    ): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val supabaseUrl = prefs.getString(KEY_SUPABASE_URL, "") ?: ""
        val supabaseAnonKey = prefs.getString(KEY_SUPABASE_ANON_KEY, "") ?: ""
        val userId = prefs.getString(KEY_USER_ID, "") ?: ""
        val accessToken = prefs.getString(KEY_ACCESS_TOKEN, "") ?: ""

        if (supabaseUrl.isEmpty() || supabaseAnonKey.isEmpty() || userId.isEmpty()) {
            Log.w(TAG, "Missing Supabase credentials in SharedPreferences for background save.")
            return false
        }

        try {
            // 1. Insert into transactions table
            val txPayload = JSONObject().apply {
                put("id", txId)
                put("user_id", userId)
                put("account_id", accountId)
                put("type", "expense")
                put("amount_minor", amountMinor)
                put("currency", "INR")
                if (!categoryId.isNullOrEmpty()) {
                    put("category_id", categoryId)
                }
                put("description", description)
                put("date", dateStr)
            }

            val txEndpoint = URL("\$supabaseUrl/rest/v1/transactions")
            val conn = txEndpoint.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("apikey", supabaseAnonKey)
            conn.setRequestProperty("Authorization", "Bearer \\${if (accessToken.isNotEmpty()) accessToken else supabaseAnonKey}")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Prefer", "return=representation")
            conn.doOutput = true
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(txPayload.toString())
                writer.flush()
            }

            val responseCode = conn.responseCode
            if (responseCode in 200..299) {
                Log.d(TAG, "Successfully persisted transaction directly to Supabase. HTTP \$responseCode")

                // 2. Fetch current balance & update account balance
                try {
                    val accEndpoint = URL("\$supabaseUrl/rest/v1/accounts?id=eq.\$accountId&select=balance")
                    val accConn = accEndpoint.openConnection() as HttpURLConnection
                    accConn.requestMethod = "GET"
                    accConn.setRequestProperty("apikey", supabaseAnonKey)
                    accConn.setRequestProperty("Authorization", "Bearer \\${if (accessToken.isNotEmpty()) accessToken else supabaseAnonKey}")
                    accConn.connectTimeout = 5000

                    if (accConn.responseCode in 200..299) {
                        val respStr = accConn.inputStream.bufferedReader().use { it.readText() }
                        val accArr = JSONArray(respStr)
                        if (accArr.length() > 0) {
                            val currBalance = accArr.getJSONObject(0).optLong("balance", 0L)
                            val newBalance = currBalance - amountMinor

                            val patchConn = URL("\$supabaseUrl/rest/v1/accounts?id=eq.\$accountId").openConnection() as HttpURLConnection
                            patchConn.requestMethod = "PATCH"
                            patchConn.setRequestProperty("apikey", supabaseAnonKey)
                            patchConn.setRequestProperty("Authorization", "Bearer \\${if (accessToken.isNotEmpty()) accessToken else supabaseAnonKey}")
                            patchConn.setRequestProperty("Content-Type", "application/json")
                            patchConn.doOutput = true

                            val patchPayload = JSONObject().apply {
                                put("balance", newBalance)
                            }
                            OutputStreamWriter(patchConn.outputStream).use { w ->
                                w.write(patchPayload.toString())
                                w.flush()
                            }
                            patchConn.responseCode
                        }
                    }
                } catch (accErr: Exception) {
                    Log.w(TAG, "Non-fatal account balance update exception", accErr)
                }

                // Notify React Native upon wake
                PocketWiseShakeModule.emitExpenseCreated(txPayload)
                return true
            } else {
                val errBody = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                Log.e(TAG, "Supabase HTTP error \$responseCode: \$errBody")
                return false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception persisting expense to Supabase", e)
            return false
        }
    }

    private fun setLoading(loading: Boolean) {
        isSubmitting = loading
        btnDone.isEnabled = !loading
        btnDone.text = if (loading) "" else "DONE"
        pbLoading.visibility = if (loading) View.VISIBLE else View.GONE
        tvError.visibility = View.GONE
    }

    private fun showError(message: String) {
        tvError.text = message
        tvError.visibility = View.VISIBLE
    }

    private fun playSuccessHaptic() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(80)
                }
            }
        } catch (e: Exception) {
            // Ignore haptic failure
        }
    }

    private fun incrementLifecycleCount(countKey: String, timeKey: String?) {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val current = prefs.getLong(countKey, 0L) + 1L
            prefs.edit().apply {
                putLong(countKey, current)
                if (timeKey != null) {
                    putLong(timeKey, System.currentTimeMillis())
                }
            }.apply()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to persist lifecycle count for \$countKey", e)
        }
    }

    private fun incrementPopupLaunchSuccess() {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val successes = prefs.getLong(KEY_POPUP_LAUNCH_SUCCESSES, 0L) + 1L
            prefs.edit().apply {
                putLong(KEY_POPUP_LAUNCH_SUCCESSES, successes)
                putLong(KEY_LAST_POPUP_LAUNCH_SUCCESS, System.currentTimeMillis())
                putString(KEY_LAST_POPUP_LAUNCH_ERROR, "None")
            }.apply()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to persist popup launch success", e)
        }
    }

    private fun dismissPopup() {
        ShakeDetector.isPopupActive = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            finishAndRemoveTask()
        } else {
            finish()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        dismissPopup()
        @Suppress("DEPRECATION")
        super.onBackPressed()
    }

    companion object {
        private const val TAG = "QuickExpenseActivity"
        private const val PREFS_NAME = "pocketwise_shake_prefs"
        private const val KEY_ACCOUNTS = "cached_accounts"
        private const val KEY_CATEGORIES = "cached_categories"
        private const val KEY_SUPABASE_URL = "supabase_url"
        private const val KEY_SUPABASE_ANON_KEY = "supabase_anon_key"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_ACCESS_TOKEN = "access_token"

        private const val KEY_POPUP_ON_CREATE = "diag_popup_on_create_count"
        private const val KEY_POPUP_ON_START = "diag_popup_on_start_count"
        private const val KEY_POPUP_ON_RESUME = "diag_popup_on_resume_count"
        private const val KEY_POPUP_ON_PAUSE = "diag_popup_on_pause_count"
        private const val KEY_POPUP_ON_STOP = "diag_popup_on_stop_count"
        private const val KEY_POPUP_ON_DESTROY = "diag_popup_on_destroy_count"
        private const val KEY_LAST_POPUP_ON_CREATE_MS = "diag_last_popup_on_create_ms"
        private const val KEY_LAST_POPUP_ON_RESUME_MS = "diag_last_popup_on_resume_ms"
        private const val KEY_LAST_POPUP_ON_DESTROY_MS = "diag_last_popup_on_destroy_ms"

        private const val KEY_POPUP_LAUNCH_SUCCESSES = "diag_popup_launch_successes"
        private const val KEY_LAST_POPUP_LAUNCH_SUCCESS = "diag_last_popup_launch_success_ms"
        private const val KEY_LAST_POPUP_LAUNCH_ERROR = "diag_last_popup_launch_error"
    }
}
`;

      // 2f. ShakeBootReceiver.kt
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
      fs.writeFileSync(path.join(shakeDir, 'QuickExpenseActivity.kt'), quickExpenseActivityContent);
      fs.writeFileSync(path.join(shakeDir, 'ShakeBootReceiver.kt'), shakeBootReceiverContent);

      // 2g. XML Layout: activity_quick_expense.xml
      const resLayoutDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'layout');
      if (!fs.existsSync(resLayoutDir)) {
        fs.mkdirSync(resLayoutDir, { recursive: true });
      }

      const layoutContent = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/rootContainer"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_gravity="center"
    android:padding="8dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:background="@drawable/bg_quick_expense_dialog"
        android:elevation="12dp"
        android:minWidth="320dp"
        android:orientation="vertical"
        android:padding="22dp">

        <!-- Header Row -->
        <RelativeLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="16dp">

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_alignParentStart="true"
                android:layout_centerVertical="true"
                android:layout_toStartOf="@+id/btnClose"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="⚡"
                    android:textSize="20sp" />

                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="8dp"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:singleLine="true"
                    android:text="Quick Expense"
                    android:textColor="#FFFFFF"
                    android:textSize="18sp"
                    android:textStyle="bold" />
            </LinearLayout>

            <TextView
                android:id="@+id/btnClose"
                android:layout_width="36dp"
                android:layout_height="36dp"
                android:layout_alignParentEnd="true"
                android:layout_centerVertical="true"
                android:background="?attr/selectableItemBackgroundBorderless"
                android:gravity="center"
                android:text="✕"
                android:textColor="#A1A1AA"
                android:textSize="18sp"
                android:textStyle="bold" />
        </RelativeLayout>

        <!-- Amount Section -->
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="6dp"
            android:text="AMOUNT (₹)"
            android:textColor="#A1A1AA"
            android:textSize="11sp"
            android:textStyle="bold" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="52dp"
            android:layout_marginBottom="14dp"
            android:background="@drawable/bg_input_field"
            android:gravity="center_vertical"
            android:orientation="horizontal"
            android:paddingHorizontal="14dp">

            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="₹"
                android:textColor="#10B981"
                android:textSize="20sp"
                android:textStyle="bold" />

            <EditText
                android:id="@+id/etAmount"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:layout_marginStart="8dp"
                android:background="@null"
                android:hint="500"
                android:inputType="numberDecimal"
                android:maxLines="1"
                android:singleLine="true"
                android:textColor="#FFFFFF"
                android:textColorHint="#71717A"
                android:textSize="20sp"
                android:textStyle="bold" />
        </LinearLayout>

        <!-- Description Section -->
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="6dp"
            android:text="DESCRIPTION"
            android:textColor="#A1A1AA"
            android:textSize="11sp"
            android:textStyle="bold" />

        <EditText
            android:id="@+id/etDescription"
            android:layout_width="match_parent"
            android:layout_height="50dp"
            android:layout_marginBottom="14dp"
            android:background="@drawable/bg_input_field"
            android:hint="e.g. Petrol, Coffee, Groceries"
            android:inputType="textCapSentences"
            android:maxLines="1"
            android:paddingHorizontal="14dp"
            android:singleLine="true"
            android:textColor="#FFFFFF"
            android:textColorHint="#71717A"
            android:textSize="14sp" />

        <!-- Account Spinner -->
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="6dp"
            android:text="ACCOUNT"
            android:textColor="#A1A1AA"
            android:textSize="11sp"
            android:textStyle="bold" />

        <Spinner
            android:id="@+id/spAccount"
            android:layout_width="match_parent"
            android:layout_height="48dp"
            android:layout_marginBottom="14dp"
            android:background="@drawable/bg_input_field"
            android:paddingHorizontal="10dp"
            android:spinnerMode="dropdown" />

        <!-- Category Spinner -->
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="6dp"
            android:text="CATEGORY"
            android:textColor="#A1A1AA"
            android:textSize="11sp"
            android:textStyle="bold" />

        <Spinner
            android:id="@+id/spCategory"
            android:layout_width="match_parent"
            android:layout_height="48dp"
            android:layout_marginBottom="16dp"
            android:background="@drawable/bg_input_field"
            android:paddingHorizontal="10dp"
            android:spinnerMode="dropdown" />

        <!-- Inline Error Message -->
        <TextView
            android:id="@+id/tvError"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="10dp"
            android:gravity="center"
            android:textColor="#EF4444"
            android:textSize="12sp"
            android:visibility="gone" />

        <!-- Done / Submit Button -->
        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="50dp">

            <Button
                android:id="@+id/btnDone"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:background="@drawable/bg_button_done"
                android:text="DONE"
                android:textAllCaps="true"
                android:textColor="#FFFFFF"
                android:textSize="15sp"
                android:textStyle="bold" />

            <ProgressBar
                android:id="@+id/pbLoading"
                android:layout_width="28dp"
                android:layout_height="28dp"
                android:layout_gravity="center"
                android:indeterminateTint="#FFFFFF"
                android:visibility="gone" />
        </FrameLayout>
    </LinearLayout>
</FrameLayout>
`;
      fs.writeFileSync(path.join(resLayoutDir, 'activity_quick_expense.xml'), layoutContent);

      // 2h. XML Drawables
      const resDrawableDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
      if (!fs.existsSync(resDrawableDir)) {
        fs.mkdirSync(resDrawableDir, { recursive: true });
      }

      const bgDialogContent = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#18181B" />
    <corners android:radius="24dp" />
    <stroke
        android:width="1dp"
        android:color="#27272A" />
</shape>
`;

      const bgInputContent = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#27272A" />
    <corners android:radius="14dp" />
    <stroke
        android:width="1dp"
        android:color="#3F3F46" />
</shape>
`;

      const bgButtonContent = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#10B981" />
    <corners android:radius="14dp" />
</shape>
`;

      fs.writeFileSync(path.join(resDrawableDir, 'bg_quick_expense_dialog.xml'), bgDialogContent);
      fs.writeFileSync(path.join(resDrawableDir, 'bg_input_field.xml'), bgInputContent);
      fs.writeFileSync(path.join(resDrawableDir, 'bg_button_done.xml'), bgButtonContent);

      // 2i. XML Styles: Ensure Theme.PocketWise.QuickExpenseDialog is in styles.xml
      const resValuesDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values');
      if (!fs.existsSync(resValuesDir)) {
        fs.mkdirSync(resValuesDir, { recursive: true });
      }

      const stylesPath = path.join(resValuesDir, 'styles.xml');
      const dialogStyleEntry = `  <style name="Theme.PocketWise.QuickExpenseDialog" parent="Theme.AppCompat.DayNight.Dialog">
    <item name="android:windowIsTranslucent">true</item>
    <item name="android:windowBackground">@android:color/transparent</item>
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowIsFloating">true</item>
    <item name="android:backgroundDimEnabled">true</item>
    <item name="android:backgroundDimAmount">0.6</item>
    <item name="android:windowAnimationStyle">@android:style/Animation.Dialog</item>
    <item name="android:windowMinWidthMajor">88%</item>
    <item name="android:windowMinWidthMinor">88%</item>
  </style>`;

      if (fs.existsSync(stylesPath)) {
        let stylesContent = fs.readFileSync(stylesPath, 'utf8');
        if (!stylesContent.includes('Theme.PocketWise.QuickExpenseDialog')) {
          if (stylesContent.includes('</resources>')) {
            stylesContent = stylesContent.replace('</resources>', `${dialogStyleEntry}\n</resources>`);
          } else {
            stylesContent = `<resources xmlns:tools="http://schemas.android.com/tools">\n${dialogStyleEntry}\n</resources>`;
          }
          fs.writeFileSync(stylesPath, stylesContent);
        } else {
          // Update existing dialog style to ensure minWidth attributes are present
          if (!stylesContent.includes('android:windowMinWidthMinor')) {
            stylesContent = stylesContent.replace(
              'Theme.PocketWise.QuickExpenseDialog" parent="Theme.AppCompat.DayNight.Dialog">',
              `Theme.PocketWise.QuickExpenseDialog" parent="Theme.AppCompat.DayNight.Dialog">\n    <item name="android:windowMinWidthMajor">88%</item>\n    <item name="android:windowMinWidthMinor">88%</item>`
            );
            fs.writeFileSync(stylesPath, stylesContent);
          }
        }
      } else {
        const fullStylesContent = `<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:enforceNavigationBarContrast" tools:targetApi="29">true</item>
    <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="android:statusBarColor">#ffffff</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="AppTheme">
    <item name="android:windowBackground">@drawable/ic_launcher_background</item>
  </style>
${dialogStyleEntry}
</resources>
`;
        fs.writeFileSync(stylesPath, fullStylesContent);
      }

      // 2j. Ensure MainApplication.kt registers PocketWiseShakePackage & ActivityLifecycleCallbacks
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
        }

        if (!appContent.includes('PocketWiseShakeModule.isMainActivityResumed')) {
          if (!appContent.includes('import android.app.Activity')) {
            appContent = appContent.replace(
              'import android.app.Application',
              'import android.app.Activity\nimport android.app.Application\nimport android.os.Bundle'
            );
          }
          const lifecycleCallbacksSnippet = `    registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
      private var resumedCount = 0

      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
      override fun onActivityStarted(activity: Activity) {}
      override fun onActivityResumed(activity: Activity) {
        if (activity is MainActivity) {
          com.pocketwise.app.shake.PocketWiseShakeModule.isMainActivityResumed = true
        }
        resumedCount++
        com.pocketwise.app.shake.PocketWiseShakeModule.isAppForeground = resumedCount > 0
      }
      override fun onActivityPaused(activity: Activity) {
        if (activity is MainActivity) {
          com.pocketwise.app.shake.PocketWiseShakeModule.isMainActivityResumed = false
        }
        resumedCount = Math.max(0, resumedCount - 1)
        com.pocketwise.app.shake.PocketWiseShakeModule.isAppForeground = resumedCount > 0
      }
      override fun onActivityStopped(activity: Activity) {}
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
      override fun onActivityDestroyed(activity: Activity) {
        if (activity is MainActivity) {
          com.pocketwise.app.shake.PocketWiseShakeModule.isMainActivityResumed = false
        }
      }
    })\n`;
          if (appContent.includes('super.onCreate()')) {
            appContent = appContent.replace('super.onCreate()', `super.onCreate()\n${lifecycleCallbacksSnippet}`);
          }
        }

        fs.writeFileSync(mainAppPath, appContent);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidShakeDetector;
