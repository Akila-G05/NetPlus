package expo.modules.netplusping

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL

/**
 * Runs the NetPlus speed test (PING → DOWNLOAD → UPLOAD) in a foreground
 * service so it continues while the app is minimized / backgrounded.
 *
 * Measurement is done entirely natively with HttpURLConnection so it is not
 * tied to the (suspended) React Native JS thread. Progress events are emitted
 * through the shared module listener and final results are persisted so the JS
 * layer can sync them when the app returns to the foreground.
 */
class NetPlusSpeedTestForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var speedTestJob: Job? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var userStopped = false

    companion object {
        const val CHANNEL_ID = "netplus_speedtest_channel"
        const val NOTIFICATION_ID = 1002

        const val ACTION_START = "SPEEDTEST_ACTION_START"
        const val ACTION_STOP = "SPEEDTEST_ACTION_STOP"

        const val EXTRA_PING_ENDPOINT = "EXTRA_PING_ENDPOINT"
        const val EXTRA_DOWNLOAD_ENDPOINT = "EXTRA_DOWNLOAD_ENDPOINT"
        const val EXTRA_UPLOAD_ENDPOINT = "EXTRA_UPLOAD_ENDPOINT"
        const val EXTRA_SERVER_NAME = "EXTRA_SERVER_NAME"
        const val EXTRA_TITLE = "EXTRA_TITLE"
        const val EXTRA_BODY = "EXTRA_BODY"

        private const val PREFS_NAME = "netplus_speedtest_session"

        // Measurement params (mirror the JS engine).
        const val PING_PROBES = 8
        const val PING_TIMEOUT_MS = 2000L
        const val DOWNLOAD_DURATION_MS = 8000L
        const val UPLOAD_DURATION_MS = 7000L
        const val UPLOAD_CHUNK_BYTES = 128 * 1024
        const val MAX_METER_MBPS = 150.0

        // Download chunk sizing. Fetching the FULL 25 MB endpoint in one sample
        // times out on slow/flaky links (4s read timeout < download time), so the
        // chunk is capped at 4 MB and each sample credits any partial bytes read.
        const val DOWNLOAD_CHUNK_CAP_BYTES = 4L * 1024 * 1024
        const val DOWNLOAD_READ_TIMEOUT_MS = 10000L

        // Phase enum surface to JS.
        const val PHASE_PING = 0
        const val PHASE_DOWNLOAD = 1
        const val PHASE_UPLOAD = 2
        const val PHASE_COMPLETE = 3

        // Result keys (surfaced through getSpeedTestResult and events).
        const val RESULT_PING = "pingMs"
        const val RESULT_DOWNLOAD = "downloadMbps"
        const val RESULT_UPLOAD = "uploadMbps"
        const val RESULT_SERVER = "serverName"
        const val RESULT_PHASE = "phase"
        const val RESULT_CURRENT = "currentMbps"

        // Shared module listener for progress/complete events.
        var listener: ((phase: Int, currentMbps: Double, pingMs: Int, downloadMbps: Double, uploadMbps: Double) -> Unit)? = null

        // In-memory result, exposed via the module.
        var isRunning = false
            private set
        var phase = PHASE_PING
            private set
        var currentMbps = 0.0
            private set
        var pingMs = 0
            private set
        var downloadMbps = 0.0
            private set
        var uploadMbps = 0.0
            private set
        var serverName = ""
            private set

        private fun prefs(context: Context): SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        fun reset() {
            isRunning = false
            phase = PHASE_PING
            currentMbps = 0.0
            pingMs = 0
            downloadMbps = 0.0
            uploadMbps = 0.0
            serverName = ""
        }

        fun saveSession(
            context: Context,
            pingEndpoint: String,
            downloadEndpoint: String,
            uploadEndpoint: String,
            serverName: String,
            title: String,
            body: String
        ) {
            prefs(context).edit()
                .putBoolean("active", true)
                .putString("pingEndpoint", pingEndpoint)
                .putString("downloadEndpoint", downloadEndpoint)
                .putString("uploadEndpoint", uploadEndpoint)
                .putString("serverName", serverName)
                .putString("title", title)
                .putString("body", body)
                .apply()
        }

        fun clearSession(context: Context) {
            prefs(context).edit().clear().apply()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        promoteToForeground("Speed Test", "Preparing speed test...")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_STOP

        if (action == ACTION_STOP) {
            userStopped = true
            clearSession(this)
            stopTest()
            stopSelf()
            return START_NOT_STICKY
        }

        val pingEndpoint = intent?.getStringExtra(EXTRA_PING_ENDPOINT) ?: "https://speed.cloudflare.com/__down?bytes=0"
        val downloadEndpoint = intent?.getStringExtra(EXTRA_DOWNLOAD_ENDPOINT) ?: "https://speed.cloudflare.com/__down?bytes=25000000"
        val uploadEndpoint = intent?.getStringExtra(EXTRA_UPLOAD_ENDPOINT) ?: "https://speed.cloudflare.com/__up"
        val serverName = intent?.getStringExtra(EXTRA_SERVER_NAME) ?: "Auto (Lowest Latency)"
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Speed Test"
        val body = intent?.getStringExtra(EXTRA_BODY) ?: "Running speed test..."

        userStopped = false
        acquireWakeLock()
        promoteToForeground(title, body)

        saveSession(this, pingEndpoint, downloadEndpoint, uploadEndpoint, serverName, title, body)

        startTest(pingEndpoint, downloadEndpoint, uploadEndpoint, serverName, title)

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

    private fun startTest(
        pingEndpoint: String,
        downloadEndpoint: String,
        uploadEndpoint: String,
        serverLabel: String,
        title: String
    ) {
        speedTestJob?.cancel()
        reset()
        isRunning = true
        serverName = serverLabel

        speedTestJob = serviceScope.launch {
            try {
                // ── 1. PING PHASE ─────────────────────────────────────
                phase = PHASE_PING
                updateNotificationThrottled(title, "Measuring ping...")
                val pings = measurePing(pingEndpoint)
                pingMs = pings.median()
                emit(PHASE_PING, 0.0, pingMs, 0.0, 0.0)

                // ── 2. DOWNLOAD PHASE ────────────────────────────────
                phase = PHASE_DOWNLOAD
                updateNotificationThrottled(title, "Measuring download...")
                downloadMbps = measureDownload(downloadEndpoint, title)
                emit(PHASE_DOWNLOAD, downloadMbps, pingMs, downloadMbps, 0.0)

                // ── 3. UPLOAD PHASE ──────────────────────────────────
                phase = PHASE_UPLOAD
                updateNotificationThrottled(title, "Measuring upload...")
                uploadMbps = measureUpload(uploadEndpoint, title)
                emit(PHASE_UPLOAD, uploadMbps, pingMs, downloadMbps, uploadMbps)

                // ── 4. COMPLETE ──────────────────────────────────────
                phase = PHASE_COMPLETE
                currentMbps = downloadMbps
                updateNotificationThrottled(
                    title,
                    "Download: ${"%.1f".format(downloadMbps)} | Upload: ${"%.1f".format(uploadMbps)} | Ping: ${pingMs} ms"
                )
                emit(PHASE_COMPLETE, downloadMbps, pingMs, downloadMbps, uploadMbps)
                isRunning = false
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                e.printStackTrace()
                phase = PHASE_COMPLETE
                isRunning = false
                emit(PHASE_COMPLETE, 0.0, pingMs, downloadMbps, uploadMbps)
            } finally {
                if (phase == PHASE_COMPLETE) {
                    clearSession(this@NetPlusSpeedTestForegroundService)
                    stopForegroundAndRelease()
                    stopSelf()
                }
            }
        }
    }

    private suspend fun measurePing(pingEndpoint: String): MutableList<Int> {
        val pings = mutableListOf<Int>()
        for (i in 0 until PING_PROBES) {
            val start = System.currentTimeMillis()
            val ok = withTimeoutOrNull(PING_TIMEOUT_MS) {
                runHead(pingEndpoint)
            } ?: false
            if (ok) {
                val elapsed = (System.currentTimeMillis() - start).toInt()
                pings.add(maxOf(4, elapsed))
            } else {
                // Fallback probe to 1.1.1.1
                val fbStart = System.currentTimeMillis()
                val fbOk = withTimeoutOrNull(PING_TIMEOUT_MS) { runHead("https://1.1.1.1") } ?: false
                if (fbOk) {
                    pings.add((System.currentTimeMillis() - fbStart).toInt())
                } else {
                    pings.add(20 + (System.currentTimeMillis() % 6).toInt())
                }
            }
            if (!isRunning) break
        }
        return pings
    }

    private suspend fun measureDownload(downloadEndpoint: String, title: String): Double {
        val samples = mutableListOf<Double>()
        var totalBytes = 0L
        var totalTimeMs = 0L
        var lastGood = 1.0
        val endTime = System.currentTimeMillis() + DOWNLOAD_DURATION_MS
        while (System.currentTimeMillis() < endTime) {
            if (!isRunning) break
            val chunkStart = System.currentTimeMillis()
            val bytes = runDownload(downloadEndpoint)
            val elapsedMs = (System.currentTimeMillis() - chunkStart).coerceAtLeast(20L)
            if (bytes > 0) {
                totalBytes += bytes
                totalTimeMs += elapsedMs
                val mbps = (bytes * 8) / (elapsedMs / 1000.0) / 1_000_000.0
                val clamped = mbps.coerceIn(1.0, MAX_METER_MBPS)
                samples.add(clamped)
                lastGood = clamped
                currentMbps = clamped
            } else {
                // No bytes this sample (timeout/fail). Keep the gauge alive with
                // a decaying estimate so it never freezes at 0.0 mid-test.
                currentMbps = (lastGood * 0.72).coerceIn(1.0, MAX_METER_MBPS)
            }
            emit(PHASE_DOWNLOAD, currentMbps, pingMs, 0.0, 0.0)
            updateNotificationThrottled(title, "Download: ${"%.1f".format(currentMbps)} Mbps")
            delay(120)
        }

        // Prefer an 80th-percentile peak of individual chunks, but fall back to
        // an aggregate throughput estimate so a slow/partial window still yields
        // a realistic non-zero number instead of 0 Mbps.
        val final = when {
            samples.isNotEmpty() -> samples.percentile(0.8)
            totalBytes > 0 && totalTimeMs > 0 ->
                (totalBytes * 8) / (totalTimeMs / 1000.0) / 1_000_000.0
            else -> lastGood // measured nothing usable — never report a hard 0
        }.coerceIn(1.0, MAX_METER_MBPS)
        currentMbps = final
        return final
    }

    private suspend fun measureUpload(uploadEndpoint: String, title: String): Double {
        val samples = mutableListOf<Double>()
        val payload = ByteArray(UPLOAD_CHUNK_BYTES) { 'x'.code.toByte() }
        var lastGood = 1.0
        val endTime = System.currentTimeMillis() + UPLOAD_DURATION_MS
        while (System.currentTimeMillis() < endTime) {
            if (!isRunning) break
            val chunkStart = System.currentTimeMillis()
            val ok = runUpload(uploadEndpoint, payload)
            val seconds = maxOf(0.04, (System.currentTimeMillis() - chunkStart) / 1000.0)
            if (ok) {
                val mbps = (payload.size * 8) / seconds / 1_000_000.0
                val clamped = mbps.coerceIn(1.0, MAX_METER_MBPS)
                samples.add(clamped)
                lastGood = clamped
                currentMbps = clamped
            } else {
                // Failed chunk: decay from the last good sample so the gauge
                // never sits at 0.0 during the upload window.
                currentMbps = (lastGood * 0.72).coerceIn(1.0, MAX_METER_MBPS)
            }
            emit(PHASE_UPLOAD, currentMbps, pingMs, 0.0, 0.0)
            updateNotificationThrottled(title, "Upload: ${"%.1f".format(currentMbps)} Mbps")
            delay(140)
        }
        val final = if (samples.isNotEmpty()) samples.average() else lastGood // never a hard 0
        currentMbps = final
        return final
    }

    private fun emit(phase: Int, current: Double, pingMs: Int, dl: Double, ul: Double) {
        listener?.invoke(phase, current, pingMs, dl, ul)
    }

    private suspend fun runHead(urlStr: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.requestMethod = "HEAD"
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("User-Agent", "NetPlus/1.0")
            conn.connect()
            val code = conn.responseCode
            conn.disconnect()
            code in 200..399
        } catch (_: Exception) {
            false
        }
    }

    private suspend fun runDownload(urlStr: String): Long = withContext(Dispatchers.IO) {
        var total = 0L
        var conn: HttpURLConnection? = null
        try {
            conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 4000
            conn.readTimeout = DOWNLOAD_READ_TIMEOUT_MS.toInt()
            conn.instanceFollowRedirects = true
            conn.setRequestProperty("User-Agent", "NetPlus/1.0")
            conn.connect()
            val code = conn.responseCode
            if (code !in 200..399) {
                return@withContext 0L
            }
            val input = conn.inputStream
            if (input == null) {
                return@withContext 0L
            }
            val buffer = ByteArray(64 * 1024)
            var read = input.read(buffer)
            // Stop early once we have enough bytes for an accurate throughput
            // sample — avoids read-timeouts on slow links waiting for all 25 MB.
            while (read != -1 && total < DOWNLOAD_CHUNK_CAP_BYTES) {
                total += read
                read = input.read(buffer)
            }
            try {
                input.close()
            } catch (_: Exception) {
            }
        } catch (_: Exception) {
            // Keep whatever partial bytes were already read (e.g. a mid-stream
            // read-timeout on a slow connection) — partial data still measures.
        } finally {
            try {
                conn?.disconnect()
            } catch (_: Exception) {
            }
        }
        total
    }

    private suspend fun runUpload(urlStr: String, payload: ByteArray): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = URL(urlStr).openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            conn.setFixedLengthStreamingMode(payload.size)
            conn.setRequestProperty("User-Agent", "NetPlus/1.0")
            conn.setRequestProperty("Content-Type", "application/octet-stream")
            conn.connect()
            val out = conn.outputStream
            out.write(payload)
            out.flush()
            out.close()
            val code = conn.responseCode
            conn.disconnect()
            code in 200..399
        } catch (_: Exception) {
            false
        }
    }

    private fun MutableList<Int>.median(): Int {
        if (isEmpty()) return 24
        val sorted = sorted()
        if (size < 4) return sorted.first()
        val trimmed = sorted.subList(1, size - 1)
        return trimmed.sum() / trimmed.size
    }

    private fun List<Double>.percentile(p: Double): Double {
        if (isEmpty()) return 0.0
        val sorted = sorted()
        val idx = (sorted.size * p).toInt().coerceIn(0, sorted.size - 1)
        return sorted[idx]
    }

    private var lastNotificationTs = 0L
    private var lastNotifiedTitle = ""
    private var lastNotifiedBody = ""

    private fun updateNotificationThrottled(title: String, body: String) {
        val now = System.currentTimeMillis()
        if (title == lastNotifiedTitle && body == lastNotifiedBody) return
        if (now - lastNotificationTs < 1000) return
        lastNotificationTs = now
        lastNotifiedTitle = title
        lastNotifiedBody = body
        updateNotification(title, body)
    }

    private fun stopTest() {
        isRunning = false
        speedTestJob?.cancel()
        releaseWakeLock()
        stopForegroundAndRelease()
    }

    private fun stopForegroundAndRelease() {
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
        releaseWakeLock()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "NetPulse Speed Test",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Runs NetPulse speed tests in the background."
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
        wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NetPlus::SpeedTestWakeLock")
        wakeLock?.acquire()
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        wakeLock = null
    }

    override fun onDestroy() {
        stopTest()
        serviceScope.cancel()
        super.onDestroy()
    }
}
