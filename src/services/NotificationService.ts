import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFICATIONS_ENABLED_KEY = '@netplus/notifications-enabled';

// Configure notification handling behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private isEnabled: boolean = true;
  private initialized: boolean = false;

  async init(): Promise<boolean> {
    if (this.initialized) return this.isEnabled;
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
      if (stored !== null) {
        this.isEnabled = stored === 'true';
      } else {
        this.isEnabled = true;
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'NetPulse Diagnostic Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#adc6ff',
        });
      }
      this.initialized = true;
    } catch (e) {
      console.warn('[NotificationService] Init error:', e);
    }
    return this.isEnabled;
  }

  async isNotificationsEnabled(): Promise<boolean> {
    await this.init();
    return this.isEnabled;
  }

  async setNotificationsEnabled(enabled: boolean): Promise<boolean> {
    this.isEnabled = enabled;
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
    if (enabled) {
      return await this.requestPermissions();
    }
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (e) {
      console.warn('[NotificationService] Permission error:', e);
      return false;
    }
  }

  /**
   * Send a local notification. Silently no-ops if notifications are
   * disabled in-app or if the OS hasn't granted permission — never
   * blocks or throws so callers don't need try/catch.
   */
  async sendLocalNotification(title: string, body: string): Promise<void> {
    const enabled = await this.isNotificationsEnabled();
    if (!enabled) return;

    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('[NotificationService] Failed to send notification:', e);
    }
  }

  // ── Speed Test Complete ────────────────────────────────
  async notifySpeedTestComplete(download: number, upload: number, ping: number, serverName?: string) {
    const title = '⚡ Speed Test Complete';
    const body = `Download: ${download.toFixed(1)} Mbps | Upload: ${upload.toFixed(1)} Mbps | Ping: ${ping} ms${serverName ? ` (${serverName})` : ''}`;
    await this.sendLocalNotification(title, body);
  }
}

export const notificationService = new NotificationService();
