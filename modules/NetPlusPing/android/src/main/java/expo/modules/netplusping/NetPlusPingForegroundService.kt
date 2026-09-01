package expo.modules.netplusping

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class NetPlusPingForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pingJob: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val CHANNEL_ID = "netplus_ping_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"

        const val EXTRA_HOST = "EXTRA_HOST"
        const val EXTRA_INTERVAL = "EXTRA_INTERVAL"
        const val EXTRA_TIMEOUT = "EXTRA_TIMEOUT"
        const val EXTRA_METHOD = "EXTRA_METHOD"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"

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
            stopMonitoring()
            stopSelf()
            return START_NOT_STICKY
        }

        val host = intent?.getStringExtra(EXTRA_HOST) ?: "8.8.8.8"
        val intervalMs = intent?.getLongExtra(EXTRA_INTERVAL, 1000L) ?: 1000L
        val timeoutMs = intent?.getIntExtra(EXTRA_TIMEOUT, 3000) ?: 3000
        val method = intent?.getStringExtra(EXTRA_METHOD) ?: "icmp"
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "NetPlus Continuous Monitor"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: "Pinging $host"

        acquireWakeLock()
        promoteToForeground(title, body)

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

        pingJob = serviceScope.launch {
            while (isActive && isRunning) {
                val startTime = System.currentTimeMillis()
                val latency = if (method.equals("icmp", ignoreCase = true)) {
                    runNativePing(host, timeoutMs) ?: runHttpPing(host, timeoutMs)
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
                    updateNotification(title, "Pinging $host | Latency: ${latencyInt} ms (avg ${avg} ms)")
                    listener?.invoke(host, latencyInt, sentCount, recvCount, failCount)
                } else {
                    failCount++
                    lastLatencyMs = -1.0
                    updateNotification(title, "Pinging $host | Timeout / Failed")
                    listener?.invoke(host, -1, sentCount, recvCount, failCount)
                }

                val elapsed = System.currentTimeMillis() - startTime
                val sleepTime = maxOf(100L, intervalMs - elapsed)
                delay(sleepTime)
            }
        }
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

    private fun runNativePing(rawHost: String, timeoutMs: Int): Double? {
        val cleanHost = rawHost.trim()
            .replace(Regex("""^https?://""", RegexOption.IGNORE_CASE), "")
            .split("/")[0]
            .split(":")[0]

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

            val timeRegex = Regex("""time[=<]\s*([\d.]+)\s*ms""", RegexOption.IGNORE_CASE)
            val timeMatch = timeRegex.find(output)
            if (timeMatch != null) {
                val valMs = timeMatch.groupValues[1].toDoubleOrNull()
                if (valMs != null && valMs > 0) return valMs
            }

            val rttRegex = Regex("""(?:rtt|round-trip)\s+min/avg/max(?:/mdev)?\s*=\s*[\d.]+/([\d.]+)/""", RegexOption.IGNORE_CASE)
            val rttMatch = rttRegex.find(output)
            val rttMs = rttMatch?.groupValues?.get(1)?.toDoubleOrNull()
            if (rttMs != null && rttMs > 0) return rttMs

            if (output.contains("1 received", ignoreCase = true) ||
                output.contains("0% packet loss", ignoreCase = true) ||
                output.contains("0% loss", ignoreCase = true)) {
                1.0
            } else null
        } catch (_: Exception) {
            null
        }
    }

    private fun runHttpPing(rawHost: String, timeoutMs: Int): Double? {
        val cleanHost = rawHost.trim()
            .replace(Regex("""^https?://""", RegexOption.IGNORE_CASE), "")
            .split("/")[0]
            .split(":")[0]

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
            if (code in 200..399) latency else null
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
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
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

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetPlus::ContinuousPingWakeLock")
        }
        wakeLock?.acquire(10 * 60 * 1000L) // 10 mins timeout safety
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        wakeLock = null
    }

    override fun onDestroy() {
        stopMonitoring()
        serviceScope.cancel()
        super.onDestroy()
    }
}
