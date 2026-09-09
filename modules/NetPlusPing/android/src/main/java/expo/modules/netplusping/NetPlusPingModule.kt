package expo.modules.netplusping

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NetPlusPingModule : Module() {

  companion object {
    private var instance: NetPlusPingModule? = null

    fun emitPingResult(host: String, latency: Int, sent: Int, recv: Int, fail: Int) {
      instance?.sendEvent(
        "onPingResult",
        mapOf(
          "host" to host,
          "latency" to latency,
          "sent" to sent,
          "recv" to recv,
          "fail" to fail
        )
      )
    }

    fun emitSpeedTestProgress(phase: Int, current: Double, pingMs: Int, dl: Double, ul: Double) {
      instance?.sendEvent(
        "onSpeedTestProgress",
        mapOf(
          "phase" to phase,
          "currentMbps" to current,
          "pingMs" to pingMs,
          "downloadMbps" to dl,
          "uploadMbps" to ul
        )
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NetPlusPing")
    Events("onPingResult", "onSpeedTestProgress")

    OnCreate {
      instance = this@NetPlusPingModule
      NetPlusPingForegroundService.listener = { host, latency, sent, recv, fail ->
        emitPingResult(host, latency, sent, recv, fail)
      }
      NetPlusSpeedTestForegroundService.listener = { phase, current, pingMs, dl, ul ->
        emitSpeedTestProgress(phase, current, pingMs, dl, ul)
      }
    }

    OnDestroy {
      if (instance == this@NetPlusPingModule) {
        instance = null
      }
    }

    AsyncFunction("ping") { host: String, timeoutMs: Double ->
      val timeout = timeoutMs.toInt().coerceIn(100, 10000)
      runPing(host, timeout)
    }

    AsyncFunction("startContinuousPing") { host: String, intervalMs: Double, timeoutMs: Double, method: String, title: String, body: String, relaxMode: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(context, NetPlusPingForegroundService::class.java).apply {
          action = NetPlusPingForegroundService.ACTION_START
          putExtra(NetPlusPingForegroundService.EXTRA_HOST, host)
          putExtra(NetPlusPingForegroundService.EXTRA_INTERVAL, intervalMs.toLong())
          putExtra(NetPlusPingForegroundService.EXTRA_TIMEOUT, timeoutMs.toInt())
          putExtra(NetPlusPingForegroundService.EXTRA_METHOD, method)
          putExtra(NetPlusPingForegroundService.EXTRA_TITLE, title)
          putExtra(NetPlusPingForegroundService.EXTRA_BODY, body)
          putExtra(NetPlusPingForegroundService.EXTRA_RELAX_MODE, relaxMode)
        }
        ContextCompat.startForegroundService(context, intent)
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }

    AsyncFunction("stopContinuousPing") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(context, NetPlusPingForegroundService::class.java).apply {
          action = NetPlusPingForegroundService.ACTION_STOP
        }
        context.startService(intent)
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }

    AsyncFunction("getBackgroundStats") {
      val minMs = if (NetPlusPingForegroundService.minMs == Double.MAX_VALUE) 0 else NetPlusPingForegroundService.minMs.toInt()
      val recv = NetPlusPingForegroundService.recvCount
      val sum = NetPlusPingForegroundService.sumMs
      val avgMs = if (recv > 0) (sum / recv).toInt() else 0

      mapOf(
        "isRunning" to NetPlusPingForegroundService.isRunning,
        "sent" to NetPlusPingForegroundService.sentCount,
        "recv" to NetPlusPingForegroundService.recvCount,
        "fail" to NetPlusPingForegroundService.failCount,
        "min" to minMs,
        "max" to NetPlusPingForegroundService.maxMs.toInt(),
        "avg" to avgMs,
        "lastLatency" to NetPlusPingForegroundService.lastLatencyMs
      )
    }

    // ── Battery optimization exemption ──────────────────────────────
    AsyncFunction("isIgnoringBatteryOptimizations") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      return@AsyncFunction runCatching {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (pm?.isIgnoringBatteryOptimizations(context.packageName) == true) {
          true
        } else {
          val intent = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${context.packageName}")
          ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(intent)
          true
        }
      }.getOrElse {
        it.printStackTrace()
        false
      }
    }

    AsyncFunction("openBatteryOptimizationSettings") { ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      return@AsyncFunction runCatching {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        true
      }.getOrElse {
        it.printStackTrace()
        false
      }
    }

    // ── Background speed test ───────────────────────────────────────
    AsyncFunction("startSpeedTest") { pingEndpoint: String, downloadEndpoint: String, uploadEndpoint: String, serverName: String, title: String, body: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        NetPlusSpeedTestForegroundService.reset()
        val intent = Intent(context, NetPlusSpeedTestForegroundService::class.java).apply {
          action = NetPlusSpeedTestForegroundService.ACTION_START
          putExtra(NetPlusSpeedTestForegroundService.EXTRA_PING_ENDPOINT, pingEndpoint)
          putExtra(NetPlusSpeedTestForegroundService.EXTRA_DOWNLOAD_ENDPOINT, downloadEndpoint)
          putExtra(NetPlusSpeedTestForegroundService.EXTRA_UPLOAD_ENDPOINT, uploadEndpoint)
          putExtra(NetPlusSpeedTestForegroundService.EXTRA_SERVER_NAME, serverName)
          putExtra(NetPlusSpeedTestForegroundService.EXTRA_TITLE, title)
          putExtra(NetPlusSpeedTestForegroundService.EXTRA_BODY, body)
        }
        ContextCompat.startForegroundService(context, intent)
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }

    AsyncFunction("stopSpeedTest") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(context, NetPlusSpeedTestForegroundService::class.java).apply {
          action = NetPlusSpeedTestForegroundService.ACTION_STOP
        }
        context.startService(intent)
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }

    AsyncFunction("getSpeedTestResult") {
      mapOf(
        "isRunning" to NetPlusSpeedTestForegroundService.isRunning,
        "phase" to NetPlusSpeedTestForegroundService.phase,
        "currentMbps" to NetPlusSpeedTestForegroundService.currentMbps,
        "pingMs" to NetPlusSpeedTestForegroundService.pingMs,
        "downloadMbps" to NetPlusSpeedTestForegroundService.downloadMbps,
        "uploadMbps" to NetPlusSpeedTestForegroundService.uploadMbps,
        "serverName" to NetPlusSpeedTestForegroundService.serverName
      )
    }
  }

  private fun runPing(rawHost: String, timeoutMs: Int): Double? {
    val cleanHost = NetPlusPingForegroundService.cleanHost(rawHost)
    if (cleanHost.isEmpty()) return null
    return IcmpPing.ping(cleanHost, timeoutMs)
  }
}
