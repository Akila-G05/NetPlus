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

class NetPlusPingForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pingJob: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var userStopped = false
    private var relaxMode = false
    private var relaxTickRunning = false
    private val relaxAlarmRequestCode = 2001

    companion object {
        const val CHANNEL_ID = "netplus_ping_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val ACTION_RELAX_TICK = "ACTION_RELAX_TICK"
        const val ACTION_WATCHDOG_RESTART = "expo.modules.netplusping.RESTART_PING"
        const val ACTION_WATCHDOG_TICK = "expo.modules.netplusping.WATCHDOG_TICK"

        const val WATCHDOG_TICK_MS = 30_000L
        private const val WATCHDOG_TICK_REQUEST_CODE = 3001

        const val EXTRA_HOST = "EXTRA_HOST"
        const val EXTRA_INTERVAL = "EXTRA_INTERVAL"
        const val EXTRA_TIMEOUT = "EXTRA_TIMEOUT"
        const val EXTRA_METHOD = "EXTRA_METHOD"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"
        const val EXTRA_RELAX_MODE = "EXTRA_RELAX_MODE"
        // True for JS-initiated sessions (fresh stats); false for native restarts (restore).
        const val EXTRA_RESET = "EXTRA_RESET"

        private const val PREFS_NAME = "netplus_ping_session"
        private const val KEY_ACTIVE = "active"
        private const val KEY_HOST = "host"
        private const val KEY_INTERVAL = "interval_ms"
        private const val KEY_TIMEOUT = "timeout_ms"
        private const val KEY_METHOD = "method"
        private const val KEY_TITLE = "title"
        private const val KEY_BODY = "body"
        private const val KEY_RELAX_MODE = "relax_mode"

        // Persisted session stats (single source of truth across restarts)
        private const val KEY_STAT_SENT = "stat_sent"
        private const val KEY_STAT_RECV = "stat_recv"
        private const val KEY_STAT_FAIL = "stat_fail"
        private const val KEY_STAT_MIN = "stat_min"
        private const val KEY_STAT_MAX = "stat_max"
        private const val KEY_STAT_SUM = "stat_sum"
        private const val KEY_STAT_LAST = "stat_last"
        private const val KEY_STAT_JITTER_SUM = "stat_jitter_sum"
        private const val KEY_STAT_JITTER_COUNT = "stat_jitter_count"
        private const val NO_MIN = Int.MAX_VALUE

        internal val SCHEME_REGEX = Regex("""^https?://""", RegexOption.IGNORE_CASE)

        internal const val MIN_HTTP_LATENCY_MS = 5.0

        // Z-Pinger parity: portal targets (e.g. oneapp.hutch.lk) sit behind
        // WAFs that challenge bare Java HttpURLConnections and can stall
        // first-byte delivery — allow up to 60s and identify as a normal
        // Android app so the request clears the WAF instead of being 403'd.
        internal const val MAX_HTTP_TIMEOUT_MS = 60_000
        internal const val HTTP_USER_AGENT =
            "Dalvik/2.1.0 (Linux; U; Android 12; SM-G991B Build/SP1A.210812.016)"

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
        var prevLatencyMs = -1.0
            private set
        var jitterSumMs = 0.0
            private set
        var jitterCount = 0
            private set

        fun resetStats() {
            sentCount = 0
            recvCount = 0
            failCount = 0
            minMs = Double.MAX_VALUE
            maxMs = 0.0
            sumMs = 0.0
            lastLatencyMs = -1.0
            prevLatencyMs = -1.0
            jitterSumMs = 0.0
            jitterCount = 0
        }

        data class Session(
            val active: Boolean,
            val host: String,
            val intervalMs: Long,
            val timeoutMs: Int,
            val method: String,
            val title: String,
            val body: String,
            val relax: Boolean
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
            body: String,
            relax: Boolean
        ) {
            prefs(context).edit()
                .putBoolean(KEY_ACTIVE, true)
                .putString(KEY_HOST, host)
                .putLong(KEY_INTERVAL, intervalMs)
                .putInt(KEY_TIMEOUT, timeoutMs)
                .putString(KEY_METHOD, method)
                .putString(KEY_TITLE, title)
                .putString(KEY_BODY, body)
                .putBoolean(KEY_RELAX_MODE, relax)
                .apply()
        }

        fun clearSession(context: Context) {
            prefs(context).edit().clear().apply()
        }

        // ── Session stats persistence (single source of truth) ────────

        /** Writes the current aggregate counters to prefs. Cheap (async apply). */
        fun persistStats(context: Context) {
            prefs(context).edit()
                .putInt(KEY_STAT_SENT, sentCount)
                .putInt(KEY_STAT_RECV, recvCount)
                .putInt(KEY_STAT_FAIL, failCount)
                .putInt(KEY_STAT_MIN, if (minMs == Double.MAX_VALUE) NO_MIN else minMs.toInt())
                .putInt(KEY_STAT_MAX, maxMs.toInt())
                .putInt(KEY_STAT_SUM, sumMs.toInt())
                .putInt(KEY_STAT_LAST, if (lastLatencyMs > 0) lastLatencyMs.toInt() else -1)
                .putInt(KEY_STAT_JITTER_SUM, jitterSumMs.toInt())
                .putInt(KEY_STAT_JITTER_COUNT, jitterCount)
                .apply()
        }

        /** Loads persisted counters into the in-memory companion stats (no reset). */
        fun restoreStats(context: Context) {
            val p = prefs(context)
            sentCount = p.getInt(KEY_STAT_SENT, 0)
            recvCount = p.getInt(KEY_STAT_RECV, 0)
            failCount = p.getInt(KEY_STAT_FAIL, 0)
            val min = p.getInt(KEY_STAT_MIN, NO_MIN)
            minMs = if (min == NO_MIN) Double.MAX_VALUE else min.toDouble()
            maxMs = p.getInt(KEY_STAT_MAX, 0).toDouble()
            sumMs = p.getInt(KEY_STAT_SUM, 0).toDouble()
            lastLatencyMs = if (p.getInt(KEY_STAT_LAST, -1) > 0) p.getInt(KEY_STAT_LAST, -1).toDouble() else -1.0
            prevLatencyMs = if (lastLatencyMs > 0) lastLatencyMs else -1.0
            jitterSumMs = p.getInt(KEY_STAT_JITTER_SUM, 0).toDouble()
            jitterCount = p.getInt(KEY_STAT_JITTER_COUNT, 0)
        }

        /** Nulls persisted counters when a brand-new session starts. */
        fun clearStatsPrefs(context: Context) {
            prefs(context).edit()
                .putInt(KEY_STAT_SENT, 0)
                .putInt(KEY_STAT_RECV, 0)
                .putInt(KEY_STAT_FAIL, 0)
                .putInt(KEY_STAT_MIN, NO_MIN)
                .putInt(KEY_STAT_MAX, 0)
                .putInt(KEY_STAT_SUM, 0)
                .putInt(KEY_STAT_LAST, -1)
                .putInt(KEY_STAT_JITTER_SUM, 0)
                .putInt(KEY_STAT_JITTER_COUNT, 0)
                .apply()
        }

        /**
         * Aggregate snapshot for the JS side. If the process restarted and the
         * in-memory counters are still zeroed while a persisted run exists
         * (service not yet re-activated), they are restored first.
         */
        fun backgroundStats(context: Context): Map<String, Any?> {
            if (sentCount == 0 && prefs(context).getInt(KEY_STAT_SENT, 0) > 0) {
                restoreStats(context)
            }
            val min = if (minMs == Double.MAX_VALUE) 0 else minMs.toInt()
            val recv = recvCount
            val avg = if (recv > 0) (sumMs / recv).toInt() else 0
            val jitter = if (jitterCount > 0) (jitterSumMs / jitterCount).toInt() else 0
            return mapOf(
                "isRunning" to isRunning,
                "sent" to sentCount,
                "recv" to recvCount,
                "fail" to failCount,
                "min" to min,
                "max" to maxMs.toInt(),
                "avg" to avg,
                "lastLatency" to lastLatencyMs,
                "jitter" to jitter
            )
        }

        fun loadSession(context: Context): Session {
            val p = prefs(context)
            if (!p.getBoolean(KEY_ACTIVE, false)) {
                return Session(false, "8.8.8.8", 1000L, 3000, "http", "NetPlus Continuous Monitor", "Pinging...", false)
            }
            return Session(
                active = true,
                host = p.getString(KEY_HOST, "8.8.8.8") ?: "8.8.8.8",
                intervalMs = p.getLong(KEY_INTERVAL, 1000L),
                timeoutMs = p.getInt(KEY_TIMEOUT, 3000),
                method = p.getString(KEY_METHOD, "http") ?: "http",
                title = p.getString(KEY_TITLE, "NetPlus Continuous Monitor") ?: "NetPlus Continuous Monitor",
                body = p.getString(KEY_BODY, "Pinging...") ?: "Pinging...",
                relax = p.getBoolean(KEY_RELAX_MODE, false)
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
                putExtra(EXTRA_RELAX_MODE, s.relax)
            }

        // ── Periodic crash-recovery watchdog ─────────────────────────────
        fun watchdogPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, NetPlusPingBootReceiver::class.java)
                .setAction(ACTION_WATCHDOG_TICK)
            return PendingIntent.getBroadcast(
                context,
                WATCHDOG_TICK_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        /** Self-rearming 30s watchdog — restarts the service if it dies. */
        fun scheduleWatchdogAlarm(context: Context) {
            try {
                if (!loadSession(context).active) return
                val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val triggerAt = SystemClock.elapsedRealtime() + WATCHDOG_TICK_MS
                val pi = watchdogPendingIntent(context)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    // Inexact — no SCHEDULE_EXACT_ALARM permission needed; in doze
                    // Android batches these (acceptable: it's a crash-recovery net).
                    alarm.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                } else {
                    alarm.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun cancelWatchdogAlarm(context: Context) {
            try {
                val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                alarm.cancel(watchdogPendingIntent(context))
            } catch (e: Exception) {
                e.printStackTrace()
            }
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
            cancelWatchdogAlarm(this)
            clearSession(this)
            stopMonitoring()
            stopSelf()
            return START_NOT_STICKY
        }

        if (action == ACTION_RELAX_TICK) {
            // Alarm-driven wake in relax mode: run one probe, then re-arm.
            // Guards: a stale tick must never start pinging in precise mode
            // (e.g. a sticky redelivery after a fresh process death).
            if (isRunning && relaxMode) {
                runRelaxTick()
            }
            return START_STICKY
        }

        val host = intent?.getStringExtra(EXTRA_HOST) ?: "8.8.8.8"
        val intervalMs = intent?.getLongExtra(EXTRA_INTERVAL, 1000L) ?: 1000L
        val timeoutMs = intent?.getIntExtra(EXTRA_TIMEOUT, 3000) ?: 3000
        val method = intent?.getStringExtra(EXTRA_METHOD) ?: "http"
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "NetPlus Continuous Monitor"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: "Pinging $host"

        userStopped = false
        relaxMode = intent?.getBooleanExtra(EXTRA_RELAX_MODE, false) ?: false
        val resetSession = intent?.getBooleanExtra(EXTRA_RESET, false) ?: false
        if (relaxMode) {
            releaseWakeLock()
        } else {
            acquireWakeLock()
        }
        promoteToForeground(title, body)

        // Persist the session so a boot watchdog / process restart can restore it.
        saveSession(this, host, intervalMs, timeoutMs, method, title, body, relaxMode)

        startMonitoring(host, intervalMs, timeoutMs, method, title, relaxMode, resetSession)

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
        title: String,
        relax: Boolean,
        resetSession: Boolean
    ) {
        pingJob?.cancel()
        cancelRelaxAlarm()
        if (resetSession) {
            // Brand-new user session: zero in-memory + persisted stats.
            resetStats()
            clearStatsPrefs(this)
        } else {
            // Native restart (boot / watchdog / task-removed): restore the
            // persisted counters so the session's history survives.
            restoreStats(this)
        }
        isRunning = true
        relaxMode = relax
        relaxTickRunning = false
        // Arm the periodic crash-recovery watchdog for the session lifetime.
        scheduleWatchdogAlarm(this)
        lastNotificationTs = 0L
        lastNotifiedTitle = ""
        lastNotifiedBody = ""

        if (relax) {
            // Battery Saver: release the WakeLock and let AlarmManager wake the
            // device for each probe (inexact, so Android batches — natural cadence).
            releaseWakeLock()
            runRelaxTick()
        } else {
            // Precise mode: hold the WakeLock so the loop never suspends.
            pingJob = serviceScope.launch {
                while (isActive && isRunning) {
                    ensureWakeLockHeld()
                    val startElapsed = SystemClock.elapsedRealtime()
                    performPing(host, intervalMs, timeoutMs, method, title)
                    val elapsed = SystemClock.elapsedRealtime() - startElapsed
                    val sleepTime = maxOf(100L, intervalMs - elapsed)
                    delay(sleepTime)
                }
            }
        }
    }

    private suspend fun performPing(
        host: String,
        intervalMs: Long,
        timeoutMs: Int,
        method: String,
        title: String
    ) {
        val latency = if (method.equals("icmp", ignoreCase = true)) {
            runNativePingSafely(host, timeoutMs) ?: runHttpPing(host, timeoutMs)
        } else {
            runHttpPing(host, timeoutMs)
        }

        sentCount++
        if (latency != null && latency > 0) {
            recvCount++
            lastLatencyMs = latency
            if (prevLatencyMs > 0) {
                jitterSumMs += kotlin.math.abs(latency - prevLatencyMs)
                jitterCount++
            }
            prevLatencyMs = latency
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
        persistStats(this)
    }

    private fun runRelaxTick() {
        if (relaxTickRunning) return
        relaxTickRunning = true
        val s = loadSession(this)
        serviceScope.launch {
            try {
                if (isRunning && relaxMode) {
                    performPing(s.host, s.intervalMs, s.timeoutMs, s.method, s.title)
                }
            } finally {
                relaxTickRunning = false
                if (isRunning && relaxMode) {
                    scheduleNextRelaxAlarm(s.intervalMs)
                }
            }
        }
    }

    private fun relaxPendingIntent(): PendingIntent {
        val intent = Intent(this, NetPlusPingForegroundService::class.java)
            .setAction(ACTION_RELAX_TICK)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PendingIntent.getForegroundService(this, relaxAlarmRequestCode, intent, flags)
        } else {
            PendingIntent.getService(this, relaxAlarmRequestCode, intent, flags)
        }
    }

    private fun scheduleNextRelaxAlarm(intervalMs: Long) {
        try {
            if (!isRunning || !relaxMode) return
            val alarm = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val triggerAt = SystemClock.elapsedRealtime() + maxOf(100L, intervalMs)
            val pi = relaxPendingIntent()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Inexact + allow-while-idle: Android may batch/defer the wake,
                // giving the battery-friendly, naturally-paced cadence.
                alarm.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            } else {
                alarm.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun cancelRelaxAlarm() {
        try {
            val alarm = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            alarm.cancel(relaxPendingIntent())
        } catch (e: Exception) {
            e.printStackTrace()
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
        cancelRelaxAlarm()
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
        val clean = cleanHost(rawHost)
        if (clean.isEmpty()) return null
        val guardMs = ((timeoutMs + 2000).toLong()).coerceAtLeast(5000L)
        return withTimeoutOrNull(guardMs) {
            IcmpPing.ping(clean, timeoutMs)
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
            conn.setRequestProperty("User-Agent", HTTP_USER_AGENT)
            conn.connectTimeout = MAX_HTTP_TIMEOUT_MS
            conn.readTimeout = MAX_HTTP_TIMEOUT_MS
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
            // Keep the periodic watchdog armed and fire a fast 1s restart too.
            scheduleWatchdogRestart()
        } else {
            cancelWatchdogAlarm(this)
        }
    }
}