package expo.modules.netplusping

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Crash-recovery watchdog (non-exported): receives only the app's own
 * PendingIntents — the periodic self-rearming tick and the fast restart after
 * a task removal / unexpected destroy. Kept separate from the exported boot
 * receiver so third-party apps can't fire these custom actions.
 */
class NetPlusPingWatchdogReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        if (action == NetPlusPingForegroundService.ACTION_WATCHDOG_TICK) {
            val session = NetPlusPingForegroundService.loadSession(context)
            if (!session.active) {
                NetPlusPingForegroundService.cancelWatchdogAlarm(context)
                return
            }
            if (!NetPlusPingForegroundService.isRunning) {
                restart(context, session)
            }
            NetPlusPingForegroundService.scheduleWatchdogAlarm(context)
            return
        }

        if (action == NetPlusPingForegroundService.ACTION_WATCHDOG_RESTART) {
            val session = NetPlusPingForegroundService.loadSession(context)
            if (session.active) {
                restart(context, session)
            }
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
        const val TAG = "NetPlusPingWatchdogReceiver"
    }
}