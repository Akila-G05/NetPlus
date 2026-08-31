package expo.modules.netplusping

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

class NetPlusPingModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("NetPlusPing")

    AsyncFunction("ping") { host: String, timeoutMs: Double ->
      val timeout = timeoutMs.toInt().coerceIn(100, 10000)
      runPing(host, timeout)
    }
  }

  private fun runPing(rawHost: String, timeoutMs: Int): Double? {
    val cleanHost = rawHost.trim()
      .replace(Regex("""^https?://""", RegexOption.IGNORE_CASE), "")
      .split("/")[0]
      .split(":")[0]

    if (cleanHost.isEmpty()) return null

    val effectiveTimeoutMs = maxOf(timeoutMs, 3000)
    val timeoutSec = maxOf(3, (effectiveTimeoutMs + 999) / 1000)

    val cmd = arrayOf("ping", "-c", "1", "-w", "$timeoutSec", cleanHost)
    try {
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

      // 1. Match latency: "64 bytes from ... time=24.5 ms" or "time=24.5ms" or "time<1 ms"
      val timeRegex = Regex("""time[=<]\s*([\d.]+)\s*ms""", RegexOption.IGNORE_CASE)
      val timeMatch = timeRegex.find(output)
      if (timeMatch != null) {
        val valMs = timeMatch.groupValues[1].toDoubleOrNull()
        if (valMs != null && valMs > 0) return valMs
      }

      // 2. Match summary line: "rtt min/avg/max/mdev = 18.234/18.234/18.234/0.000 ms"
      val rttRegex = Regex("""(?:rtt|round-trip)\s+min/avg/max(?:/mdev)?\s*=\s*[\d.]+/([\d.]+)/""", RegexOption.IGNORE_CASE)
      val rttMatch = rttRegex.find(output)
      val rttMs = rttMatch?.groupValues?.get(1)?.toDoubleOrNull()
      if (rttMs != null && rttMs > 0) return rttMs

      // 3. Fallback: Check if packet was received successfully (0% packet loss / 1 received)
      if (output.contains("1 received", ignoreCase = true) || output.contains("0% packet loss", ignoreCase = true) || output.contains("0% loss", ignoreCase = true)) {
        return 1.0
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }

    return null
  }
}

