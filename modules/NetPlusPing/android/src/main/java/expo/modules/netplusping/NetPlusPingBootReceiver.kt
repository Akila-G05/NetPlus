package expo.modules.netplusping

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.Intent.ACTION_BOOT_COMPLETED
import android.content.Intent.ACTION_MY_PACKAGE_REPLACED
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Restarts background pinging after device reboot or app update. Exported
 * because it listens for system broadcasts. The timer-based crash-recovery
 * watchdog lives in [NetPlusPingWatchdogReceiver] (non-exported).
 */
class NetPlusPingBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        val restartRelevant = when (action) {
            ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "android.intent.action.REBOOT",
            ACTION_MY_PACKAGE_REPLACED -> true
            else -> false
        }
        if (!restartRelevant) return

        val session = NetPlusPingForegroundService.loadSession(context)
        if (session.active) {
            restart(context, session)
        }
    }

    private fun restart(context: Context, session: NetPlusPingForegroundService.Companion.Session) {
        try {
            val serviceIntent = NetPlusPingForegroundService.buildIntent(context, session)
            ContextCompat.startForegroundService(context, serviceIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to restart ping foreground service", e)
        }
    }

    private companion object {
        const val TAG = "NetPlusPingBootReceiver"
    }
}