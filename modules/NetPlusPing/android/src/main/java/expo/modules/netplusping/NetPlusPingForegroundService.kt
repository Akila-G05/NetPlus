package expo.modules.netplusping

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class NetPlusPingForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pingJob: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var userStopped = false

    companion object {
        const val CHANNEL_ID = "netplus_ping_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val ACTION_WATCHDOG_RESTART = "expo.modules.netplusping.RESTART_PING"

        const val EXTRA_HOST = "EXTRA_HOST"
        const val EXTRA_INTERVAL = "EXTRA_INTERVAL"
        const val EXTRA_TIMEOUT = "EXTRA_TIMEOUT"
        const val EXTRA_METHOD = "EXTRA_METHOD"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"

        private const val PREFS_NAME = "netplus_ping_session"
        private const val KEY_ACTIVE = "active"
        private const val KEY_HOST = "host"
        private const val KEY_INTERVAL = "interval_ms"
        private const val KEY_TIMEOUT = "timeout_ms"
        private const val KEY_METHOD = "method"
        private const val KEY_TITLE = "title"
        private const val KEY_BODY = "body"

        internal val SCHEME_REGEX = Regex("""^https?://""", RegexOption.IGNORE_CASE)
        internal val TIME_REGEX = Regex("""time[=<]\s*([\d.]+)\s*ms""", RegexOption.IGNORE_CASE)
        internal val RTT_REGEX = Regex("""(?:rtt|round-trip)\s+min/avg/max(?:/mdev)?\s*=\s*[\d.]+/([\d.]+)/""", RegexOption.IGNORE_CASE)

        // Minimum valid latency before a sample is trusted. Values below this
        // are CDN/cache/loopback artifacts (e.g. the old constant "1ms") and
        // are rejected so pinging reports real network RTTs.
        private const val MIN_ICMP_LATENCY_MS = 2.0
        internal const val MIN_HTTP_LATENCY_MS = 5.0

        fun cleanHost(rawHost: String): String {
            return rawHost.trim()
                .replace(SCHEME_REGEX, "")
                .split("/")[0]
                .split(":")[0]
        }

        // Shared module listener
        var listener: ((String, Int, Int, Int, Int) -> Unit)? = null

        // In-memory stats accessible by module
        var isRunning = false
            private set
        var sentCount = 0
            private set
        var recvCount = 0
            private set
        var failCount = 0
            private set
        var minMs = Double.MAX_VALUE
            private set
        var maxMs = 0.0
            private set
        var sumMs = 0.0
            private set
        var lastLatencyMs = -1.0
            private set

        fun resetStats() {
            sentCount = 0
            recvCount = 0
            failCount = 0
            minMs = Double.MAX_VALUE
            maxMs = 0.0
            sumMs = 0.0
            lastLatencyMs = -1.0
        }

        data class Session(
            val active: Boolean,
            val host: String,
            val intervalMs: Long,
            val timeoutMs: Int,
            val method: String,
            val title: String,
            val body: String
        )

        private fun prefs(context: Context): SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun saveSession(
            context: Context,
            host: String,
            intervalMs: Long,
            timeoutMs: Int,
            method: String,
            title: String,
            body: String
        ) {
            prefs(context).edit()
                .putBoolean(KEY_ACTIVE, true)
                .putString(KEY_HOST, host)
                .putLong(KEY_INTERVAL, intervalMs)
                .putInt(KEY_TIMEOUT, timeoutMs)
                .putString(KEY_METHOD, method)
                .putString(KEY_TITLE, title)
                .putString(KEY_BODY, body)
                .apply()
        }

        fun clearSession(context: Context) {
            prefs(context).edit().clear().apply()
        }

        fun loadSession(context: Context): Session {
            val p = prefs(context)
            if (!p.getBoolean(KEY_ACTIVE, false)) {
                return Session(false, "8.8.8.8", 1000L, 3000, "http", "NetPlus Continuous Monitor", "Pinging...")
            }
            return Session(
                active = true,
                host = p.getString(KEY_HOST, "8.8.8.8") ?: "8.8.8.8",
                intervalMs = p.getLong(KEY_INTERVAL, 1000L),
                timeoutMs = p.getInt(KEY_TIMEOUT, 3000),
                method = p.getString(KEY_METHOD, "http") ?: "http",
                title = p.getString(KEY_TITLE, "NetPlus Continuous Monitor") ?: "NetPlus Continuous Monitor",
                body = p.getString(KEY_BODY, "Pinging...") ?: "Pinging..."
            )
        }

        fun buildIntent(context: Context, s: Session): Intent =
            Intent(context, NetPlusPingForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_HOST, s.host)
                putExtra(EXTRA_INTERVAL, s.intervalMs)
                putExtra(EXTRA_TIMEOUT, s.timeoutMs)
                putExtra(EXTRA_METHOD, s.method)
                putExtra(EXTRA_TITLE, s.title)
                putExtra(EXTRA_BODY, s.body)
            }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        promoteToForeground("NetPlus Continuous Monitor", "Initializing background monitoring...")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_STOP

        if (action == ACTION_STOP) {
            userStopped = true
            clearSession(this)
            stopMonitoring()
            stopSelf()
            return START_NOT_STICKY
        }

        val host = intent?.getStringExtra(EXTRA_HOST) ?: "8.8.8.8"
        val intervalMs = intent?.getLongExtra(EXTRA_INTERVAL, 1000L) ?: 1000L
        val timeoutMs = intent?.getIntExtra(EXTRA_TIMEOUT, 3000) ?: 3000
        val method = intent?.getStringExtra(EXTRA_METHOD) ?: "http"
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "NetPlus Continuous Monitor"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: "Pinging $host"

        userStopped = false
        acquireWakeLock()
        promoteToForeground(title, body)

        // Persist the session so a boot watchdog / process restart can restore it.
        saveSession(this, host, intervalMs, timeoutMs, method, title, body)

        startMonitoring(host, intervalMs, timeoutMs, method, title)

        return START_STICKY
    }

    private fun promoteToForeground(title: String, body: String) {
        val notification = buildNotification(title, body)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private var lastNotificationTs = 0L
    private var lastNotifiedTitle = ""
    private var lastNotifiedBody = ""

    private fun startMonitoring(
        host: String,
        intervalMs: Long,
        timeoutMs: Int,
        method: String,
        title: String
    ) {
        pingJob?.cancel()
        resetStats()
        isRunning = true
        lastNotificationTs = 0L
        lastNotifiedTitle = ""
        lastNotifiedBody = ""

        pingJob = serviceScope.launch {
            while (isActive && isRunning) {
                ensureWakeLockHeld()
                val startElapsed = SystemClock.elapsedRealtime()

                val latency = if (method.equals("icmp", ignoreCase = true)) {
                    runNativePingSafely(host, timeoutMs) ?: runHttpPing(host, timeoutMs)
                } else {
                    runHttpPing(host, timeoutMs)
                }

                sentCount++
                if (latency != null && latency > 0) {
                    recvCount++
                    lastLatencyMs = latency
                    if (latency < minMs) minMs = latency
                    if (latency > maxMs) maxMs = latency
                    sumMs += latency

                    val avg = (sumMs / recvCount).toInt()
                    val latencyInt = latency.toInt()
                    updateNotificationThrottled(title, "Pinging $host | Latency: ${latencyInt} ms (avg ${avg} ms)")
                    listener?.invoke(host, latencyInt, sentCount, recvCount, failCount)
                } else {
                    failCount++
                    lastLatencyMs = -1.0
                    updateNotificationThrottled(title, "Pinging $host | Timeout / Failed")
                    listener?.invoke(host, -1, sentCount, recvCount, failCount)
                }

                val elapsed = SystemClock.elapsedRealtime() - startElapsed
                val sleepTime = maxOf(100L, intervalMs - elapsed)
                delay(sleepTime)
            }
        }
    }

    private fun updateNotificationThrottled(title: String, body: String) {
        val now = System.currentTimeMillis()
        if (title == lastNotifiedTitle && body == lastNotifiedBody) return
        if (now - lastNotificationTs < 1000) return
        lastNotificationTs = now
        lastNotifiedTitle = title
        lastNotifiedBody = body
        updateNotification(title, body)
    }

    private fun stopMonitoring() {
        isRunning = false
        pingJob?.cancel()
        releaseWakeLock()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private suspend fun runNativePingSafely(rawHost: String, timeoutMs: Int): Double? {
        val guardMs = ((timeoutMs + 2000).toLong()).coerceAtLeast(5000L)
        return withTimeoutOrNull(guardMs) { runNativePing(rawHost, timeoutMs) }
    }

    private fun runNativePing(rawHost: String, timeoutMs: Int): Double? {
        val cleanHost = cleanHost(rawHost)

        if (cleanHost.isEmpty()) return null

        val effectiveTimeoutMs = maxOf(timeoutMs, 3000)
        val timeoutSec = maxOf(3, (effectiveTimeoutMs + 999) / 1000)

        val cmd = arrayOf("ping", "-c", "1", "-w", "$timeoutSec", cleanHost)
        return try {
            val process = ProcessBuilder(*cmd)
                .redirectErrorStream(true)
                .start()

            val exited = process.waitFor(effectiveTimeoutMs.toLong(), TimeUnit.MILLISECONDS)
            if (!exited) {
                try {
                    process.destroyForcibly()
                } catch (_: Throwable) {
                    process.destroy()
                }
                return null
            }

            val output = process.inputStream.bufferedReader().use { it.readText() }

            // Anti-artifact floor: reject sub-2ms RTTs so local/cache replies
            // never surface as a fake "1ms" ping.
            val timeMatch = TIME_REGEX.find(output)
            if (timeMatch != null) {
                val valMs = timeMatch.groupValues[1].toDoubleOrNull()
                if (valMs != null && valMs >= MIN_ICMP_LATENCY_MS) return valMs
            }

            val rttMatch = RTT_REGEX.find(output)
            val rttMs = rttMatch?.groupValues?.get(1)?.toDoubleOrNull()
            if (rttMs != null && rttMs >= MIN_ICMP_LATENCY_MS) return rttMs

            // No valid RTT parsed — report a failure, never fabricate.
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun runHttpPing(rawHost: String, timeoutMs: Int): Double? {
        val cleanHost = cleanHost(rawHost)

        var targetUrlStr = "https://$cleanHost/"
        if (cleanHost == "8.8.8.8" || cleanHost == "8.8.4.4" || cleanHost.contains("google")) {
            targetUrlStr = "https://www.google.com/generate_204"
        } else if (cleanHost == "1.1.1.1" || cleanHost == "1.0.0.1" || cleanHost.contains("cloudflare")) {
            targetUrlStr = "https://1.1.1.1/cdn-cgi/trace"
        }

        val start = System.currentTimeMillis()
        return try {
            val url = URL(targetUrlStr)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            conn.instanceFollowRedirects = true
            conn.connect()
            val code = conn.responseCode
            conn.disconnect()

            val latency = (System.currentTimeMillis() - start).toDouble()
            // Discard sub-floor RTTs (CDN-local cache hits measure ~1ms, not a
            // real network RTT) so HTTP pinging reports realistic latencies.
            if (code in 200..399 && latency >= MIN_HTTP_LATENCY_MS) latency else null
        } catch (_: Exception) {
            null
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "NetPulse Continuous Monitoring",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows active background ping diagnostic notifications."
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, content: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.drawable.ic_notification_antenna)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification(title: String, content: String) {
        val notification = buildNotification(title, content)
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.notify(NOTIFICATION_ID, notification)
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        releaseWakeLock()
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetPlus::ContinuousPingWakeLock")
        // Held for the entire service lifetime (released only on stop) — mirrors Z Pinger
        // so the CPU stays awake with the screen off and the ping loop never suspends.
        wakeLock?.acquire()
    }

    private fun ensureWakeLockHeld() {
        if (wakeLock?.isHeld != true) {
            acquireWakeLock()
        }
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        wakeLock = null
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // Swiping the app away must not kill background pinging: immediately relaunch
        // and schedule a watchdog re-launch in case the OS tears the process down.
        val session = loadSession(this)
        if (isRunning && session.active) {
            try {
                ContextCompat.startForegroundService(this, buildIntent(this, session))
            } catch (e: Exception) {
                e.printStackTrace()
            }
            scheduleWatchdogRestart()
        }
    }

    private fun scheduleWatchdogRestart() {
        try {
            val alarm = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(this, NetPlusPingBootReceiver::class.java)
                .setAction(ACTION_WATCHDOG_RESTART)
            val pi = PendingIntent.getBroadcast(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = SystemClock.elapsedRealtime() + 1000L
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarm.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            } else {
                alarm.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        val shouldRestart = !userStopped && isRunning && loadSession(this).active
        stopMonitoring()
        serviceScope.cancel()
        super.onDestroy()
        if (shouldRestart) {
            scheduleWatchdogRestart()
        }
    }
}