/**
 * Background Task Service — Manages background periodic network checks,
 * ping diagnostics, and local log persistence.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NETPLUS_BACKGROUND_PING_TASK = 'NETPLUS_BACKGROUND_PING_TASK';
export const BACKGROUND_LOGS_KEY = '@netplus/background-logs';
export const BACKGROUND_CONFIG_KEY = '@netplus/background-config';

export interface BackgroundLogEntry {
  id: string;
  timestamp: string;
  host: string;
  latencyMs: number;
  status: 'SUCCESS' | 'HIGH_LATENCY' | 'TIMEOUT' | 'DISCONNECTED';
  networkType: string;
}

export interface BackgroundConfig {
  enabled: boolean;
  intervalMinutes: number;
  targetHost: string;
}

// ── Define Background Task ────────────────────────────────
TaskManager.defineTask(NETPLUS_BACKGROUND_PING_TASK, async () => {
  const now = new Date();
  const timestampStr = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  try {
    const netState = await NetInfo.fetch();
    const networkType = netState.type ? netState.type.toUpperCase() : 'UNKNOWN';

    if (!netState.isConnected) {
      await saveLogEntry({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timestampStr,
        host: '8.8.8.8',
        latencyMs: 0,
        status: 'DISCONNECTED',
        networkType,
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let latency = 0;
    let status: BackgroundLogEntry['status'] = 'SUCCESS';

    try {
      await fetch('https://www.google.com/generate_204', {
        method: 'GET',
        signal: controller.signal,
      });
      latency = Date.now() - startTime;
      if (latency > 300) {
        status = 'HIGH_LATENCY';
      }
    } catch {
      status = 'TIMEOUT';
      latency = 5000;
    } finally {
      clearTimeout(timeoutId);
    }

    await saveLogEntry({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timestampStr,
      host: '8.8.8.8 (Google DNS)',
      latencyMs: latency,
      status,
      networkType,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background task execution failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Helper to save log entry
async function saveLogEntry(entry: BackgroundLogEntry) {
  try {
    const existing = await AsyncStorage.getItem(BACKGROUND_LOGS_KEY);
    const logs: BackgroundLogEntry[] = existing ? JSON.parse(existing) : [];
    logs.unshift(entry);
    // Keep up to 50 background log items
    const trimmed = logs.slice(0, 50);
    await AsyncStorage.setItem(BACKGROUND_LOGS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed saving background log:', err);
  }
}

// ── Service API Methods ───────────────────────────────────

export async function isBackgroundPingRegisteredAsync(): Promise<boolean> {
  return await TaskManager.isTaskRegisteredAsync(NETPLUS_BACKGROUND_PING_TASK);
}

export async function registerBackgroundPingAsync(intervalMinutes = 15): Promise<boolean> {
  try {
    await BackgroundFetch.registerTaskAsync(NETPLUS_BACKGROUND_PING_TASK, {
      minimumInterval: intervalMinutes * 60, // in seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (err) {
    console.error('Error registering background task:', err);
    return false;
  }
}

export async function unregisterBackgroundPingAsync(): Promise<boolean> {
  try {
    const registered = await isBackgroundPingRegisteredAsync();
    if (registered) {
      await BackgroundFetch.unregisterTaskAsync(NETPLUS_BACKGROUND_PING_TASK);
    }
    return true;
  } catch (err) {
    console.error('Error unregistering background task:', err);
    return false;
  }
}

export async function getBackgroundLogsAsync(): Promise<BackgroundLogEntry[]> {
  try {
    const json = await AsyncStorage.getItem(BACKGROUND_LOGS_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function clearBackgroundLogsAsync(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKGROUND_LOGS_KEY);
  } catch (err) {
    console.error('Failed clearing background logs:', err);
  }
}
