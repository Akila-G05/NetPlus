import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import SettingsRow from '@/components/SettingsRow';
import SimpleSelect from '@/components/SimpleSelect';
import StatBox from '@/components/StatBox';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { dataUsageTracker } from '@/services/DataUsageTracker';
import { notificationService } from '@/services/NotificationService';
import { AdEventType, InterstitialAd, MobileAds, TestIds } from '@/services/MobileAdsService';
import { gs } from '@/styles/globalStyles';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addPingResultListener,
  getBackgroundStats,
  isIgnoringBatteryOptimizations,
  startContinuousPing,
  stopContinuousPing,
} from 'netplus-ping';
import { useBatteryOnboarding } from '@/components/BatteryOnboarding';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Pulse animation hook ─────────────────────────────────
function usePulse() {
  const anim = React.useRef(new Animated.Value(0.95)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.95,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [anim]);
  return anim;
}

// ── Ping helpers ─────────────────────────────────────────
// Real ISP infrastructure IPs (not CDN/portal domains). The old portal domains
// resolve to CDN/Imperva edges inside Sri Lanka that answer from local caches,
// producing a constant ~1ms artifact instead of a real network RTT.
const TARGET_HOSTS: Record<string, string> = {
  'Google': '8.8.8.8',
  'Hutch': 'hutch.lk',
  'Dialog': 'dialog.lk',
  'Mobitel': 'mobitel.lk',
  'Airtel': 'airtel.lk',
};

function sanitizeHost(input: string): string {
  if (!input) return '';
  let host = input.trim();
  host = host.replace(/^https?:\/\//i, '');
  host = host.split('/')[0];
  if (!host.startsWith('[')) {
    host = host.split(':')[0];
  }
  return host;
}

interface PingSession {
  active: boolean;
  subscription?: { remove: () => void };
}

interface PingStats {
  min: number;
  max: number;
  avg: number;
  jitter: number;
  lossPct: number;
  successPct: number;
  sent: number;
  recv: number;
  fail: number;
}

const MAX_PING_MS = 5000;

const PING_CONFIG_KEY = '@netplus/ping-config';
const PING_METHOD_KEY = '@netplus/ping-method';
const DEFAULT_TARGET = 'Google';
const DEFAULT_INTERVAL = '5000 ms (5s)';
const DEFAULT_PING_METHOD: PingMethod = 'icmp';

const RELAX_OPTION = 'Battery Save Mode';
const RELAX_CADENCE_MS = 20000;

const targetOptions = [
  'Google',
  // Sri Lankan ISPs
  'Hutch',
  'Dialog',
  'Mobitel',
  'Airtel',
  'Custom Host / IP',
];

const intervalOptions = [
  '3000 ms (3s)',
  '5000 ms (5s)',
  '10000 ms (10s)',
  '15000 ms (15s)',
  '30000 ms (30s)',
  '60000 ms (60s)',
  RELAX_OPTION,
];

const EMPTY_STATS: PingStats = {
  min: 0,
  max: 0,
  avg: 0,
  jitter: 0,
  lossPct: 0,
  successPct: 0,
  sent: 0,
  recv: 0,
  fail: 0,
};

const COOLDOWN_MS = 3 * 60 * 1000;
// const COOLDOWN_MS = 1000;  //testing

const AD_LOAD_ON_OPEN = false;   // load ad when app opens
const AD_LOAD_ON_START = true; // load ad when user taps START
const AD_LOAD_ON_END = false;    // load ad when user taps STOP (after showing)

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-5784306310827332/4228784926';
const interstitial = InterstitialAd.createForAdRequest(adUnitId);

function resolveHost(targetConnection: string, customHost: string): string {
  if (targetConnection === 'Custom Host / IP') {
    return sanitizeHost(customHost);
  }
  return sanitizeHost(TARGET_HOSTS[targetConnection] ?? '8.8.8.8');
}

function parseIntervalMs(option: string): number {
  if (option === RELAX_OPTION) return RELAX_CADENCE_MS;
  const match = option.match(/\d+/);
  return match ? Number(match[0]) : 1000;
}

// Ping method types
type PingMethod = 'icmp' | 'http';

export default function PingingScreen() {
  const pulseScale = usePulse();

  const { batteryModalDismissed, showBatteryModal } = useBatteryOnboarding();

  // Ping Configuration State
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState(false);
  const [targetConnection, setTargetConnection] = useState(DEFAULT_TARGET);
  const [customHost, setCustomHost] = useState('');
  const [pingInterval, setPingInterval] = useState(DEFAULT_INTERVAL);
  const [pingMethod, setPingMethod] = useState<PingMethod>(DEFAULT_PING_METHOD);

  // Live ping state
  const [isPinging, setIsPinging] = useState(false);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [stats, setStats] = useState<PingStats>(EMPTY_STATS);

  const sessionRef = useRef<PingSession>({ active: false });
  const latenciesRef = useRef<number[]>([]);
  const adLoaded = useRef(false);
  const adIsLoading = useRef(false);
  const lastAdShowTime = useRef(0);

  // Guarded ad loader — prevents double `load()` calls (which the SDK drops).
  const loadInterstitial = useCallback(() => {
    if (adLoaded.current || adIsLoading.current) {
      console.log('[AdMob] Skipping load: already loaded/loading.');
      return;
    }
    adIsLoading.current = true;
    try {
      interstitial.load();
    } catch (e: any) {
      console.warn('[AdMob] load() threw:', e?.message);
      adIsLoading.current = false;
    }
  }, []);

  // Load saved settings on first open (falls back to defaults)
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PING_CONFIG_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as {
          targetConnection?: string;
          customHost?: string;
          pingInterval?: string;
        };
        let savedTarget = saved.targetConnection;
        if (savedTarget === 'Google DNS') savedTarget = 'Google';
        if (savedTarget === 'Mobitel / SLT') savedTarget = 'Mobitel';
        if (savedTarget && targetOptions.includes(savedTarget)) {
          setTargetConnection(savedTarget);
        }
        if (typeof saved.customHost === 'string') {
          setCustomHost(saved.customHost);
        }
        if (saved.pingInterval && intervalOptions.includes(saved.pingInterval)) {
          setPingInterval(saved.pingInterval);
        }
      })
      .catch(() => { })
      .then(() => AsyncStorage.getItem(PING_METHOD_KEY))
      .then((method) => {
        if (method === 'icmp' || method === 'http') {
          setPingMethod(method as PingMethod);
        }
      })
      .catch(() => { })
      .finally(() => setConfigLoaded(true));
  }, []);

  // Refresh battery-optimization exemption status (used by banner check)
  const refreshBatteryExempt = useCallback(async () => {
    const exempt = await isIgnoringBatteryOptimizations();
    setBatteryExempt(exempt);
    return exempt;
  }, []);

  // Check battery exemption on mount (for banner visibility)
  useEffect(() => {
    refreshBatteryExempt();
  }, [refreshBatteryExempt]);

  // Save settings whenever they change (after initial load)
  useEffect(() => {
    if (!configLoaded) return;
    AsyncStorage.setItem(
      PING_CONFIG_KEY,
      JSON.stringify({ targetConnection, customHost, pingInterval })
    ).catch(() => { });
    AsyncStorage.setItem(PING_METHOD_KEY, pingMethod).catch(() => { });
  }, [configLoaded, targetConnection, customHost, pingInterval, pingMethod]);

  // Ad event listeners
  useEffect(() => {
    console.log('[AdMob] Registering interstitial ad event listeners...');
    const subs = [
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[AdMob] Interstitial ad loaded successfully.');
        adLoaded.current = true;
        adIsLoading.current = false;
      }),
      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Interstitial ad was closed.');
        adLoaded.current = false;
        adIsLoading.current = false;
        if (AD_LOAD_ON_END) {
          console.log('[AdMob] Preloading next interstitial ad...');
          loadInterstitial();
        }
      }),
      interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error('[AdMob] Interstitial ad failed to load:', error);
        adLoaded.current = false;
        adIsLoading.current = false;
      }),
    ];
    if (AD_LOAD_ON_OPEN) {
      // Wait for SDK init before first load to avoid cold-start races.
      MobileAds()
        .initialize()
        .then(() => {
          console.log('[AdMob] SDK ready, loading interstitial ad...');
          loadInterstitial();
        })
        .catch(() => {
          loadInterstitial();
        });
    }
    return () => {
      console.log('[AdMob] Unregistering interstitial ad event listeners...');
      subs.forEach((s) => s());
    };
  }, [loadInterstitial]);

  const stopPing = useCallback(() => {
    sessionRef.current.active = false;
    sessionRef.current.subscription?.remove();
    sessionRef.current.subscription = undefined;

    // Clean up native continuous ping service
    stopContinuousPing().catch(() => { });

    setIsPinging(false);
    dataUsageTracker.setPingingActive(false);

    const now = Date.now();
    const isActuallyReady =
      adLoaded.current &&
        typeof (interstitial as any).getIsLoaded?.() === 'boolean'
        ? (interstitial as any).getIsLoaded()
        : adLoaded.current;

    if (isActuallyReady && now - lastAdShowTime.current >= COOLDOWN_MS) {
      console.log('[AdMob] Conditions met. Showing interstitial ad.');
      adLoaded.current = false;
      try {
        interstitial.show();
        lastAdShowTime.current = now;
        // Do NOT load here — the CLOSED listener reloads the next ad.
      } catch (e: any) {
        console.warn('[AdMob] show() threw, reloading ad:', e?.message);
        loadInterstitial();
      }
    } else {
      console.log(
        `[AdMob] Interstitial ad not shown. adLoaded: ${adLoaded.current}, cooldown remaining: ${Math.max(
          0,
          COOLDOWN_MS - (now - lastAdShowTime.current)
        )}ms`
      );
      // Nothing was shown, so (re)load for the next session end.
      if (AD_LOAD_ON_END) {
        loadInterstitial();
      }
    }
  }, [loadInterstitial]);

  useEffect(() => () => stopPing(), [stopPing]);

  const syncBackgroundStats = useCallback(async () => {
    if (!sessionRef.current.active) return;
    const bgStats = await getBackgroundStats();
    if (!bgStats || bgStats.sent === 0) return;

    const sent = bgStats.sent;
    const recv = bgStats.recv;
    const fail = bgStats.fail;
    const lossPct = sent > 0 ? Math.round((fail / sent) * 100) : 0;
    const successPct = sent > 0 ? Math.round((recv / sent) * 100) : 0;

    setStats({
      min: bgStats.min,
      max: bgStats.max,
      avg: bgStats.avg,
      jitter: 0,
      lossPct,
      successPct,
      sent,
      recv,
      fail,
    });

    if (bgStats.lastLatency > 0) {
      setCurrentLatency(Math.round(bgStats.lastLatency));
    }
  }, []);

  // Sync background stats when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && sessionRef.current.active) {
        syncBackgroundStats();
      }
    });
    return () => subscription.remove();
  }, [syncBackgroundStats]);

  const startPing = useCallback(() => {
    const host = resolveHost(targetConnection, customHost);
    if (!host) return;

    // Snapshot config so a running session isn't affected by edits
    const relaxMode = pingInterval === RELAX_OPTION;
    const intervalMs = parseIntervalMs(pingInterval);
    // Requests are capped at MAX_PING_MS — anything slower counts as a loss
    const requestTimeoutMs = Math.min(Math.max(intervalMs * 2, 3000), MAX_PING_MS);

    // Stop any existing session, but do NOT stop the native foreground
    // service here — the new startContinuousPing() intent will override
    // the running service's parameters directly.
    sessionRef.current.active = false;

    dataUsageTracker.setPingingActive(true);
    latenciesRef.current = [];
    setCurrentLatency(null);
    setStats(EMPTY_STATS);
    setIsPinging(true);
    if (AD_LOAD_ON_START) {
      loadInterstitial();
    }

    const session: PingSession = { active: true };
    sessionRef.current = session;

    // Start native continuous ping service with WakeLock and persistent notification.
    // The native service sends ICMP/HTTP pings and fires onPingResult events
    // — the JS side only subscribes to those events, no duplicate pings.
    startContinuousPing(
      host,
      intervalMs,
      requestTimeoutMs,
      pingMethod,
      'NetPlus Continuous Monitor',
      relaxMode ? `Pinging ${host} in Battery Saver mode` : `Pinging ${host} every ${pingInterval}`,
      relaxMode
    ).catch(() => { });

    // Subscribe to native ping results — single source of truth for all stats.
    const sub = addPingResultListener((event) => {
      if (!session.active) return;

      dataUsageTracker.recordPingResult(event.latency > 0);

      if (event.latency > 0) {
        const latency = Math.min(event.latency, MAX_PING_MS);
        setCurrentLatency(latency);
        const samples = [...latenciesRef.current, latency];
        latenciesRef.current = samples;
        let jitterSum = 0;
        for (let i = 1; i < samples.length; i++) {
          jitterSum += Math.abs(samples[i] - samples[i - 1]);
        }
        setStats({
          min: Math.round(Math.min(...samples)),
          max: Math.round(Math.max(...samples)),
          avg: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
          jitter:
            samples.length > 1
              ? Math.round(jitterSum / (samples.length - 1))
              : 0,
          lossPct: event.sent > 0 ? Math.round((event.fail / event.sent) * 100) : 0,
          successPct: event.sent > 0 ? Math.round((event.recv / event.sent) * 100) : 0,
          sent: event.sent,
          recv: event.recv,
          fail: event.fail,
        });
      } else {
        setCurrentLatency(null);
        setStats((prev) => ({
          ...prev,
          lossPct: event.sent > 0 ? Math.round((event.fail / event.sent) * 100) : 0,
          successPct: event.sent > 0 ? Math.round((event.recv / event.sent) * 100) : 0,
          sent: event.sent,
          recv: event.recv,
          fail: event.fail,
        }));
      }
    });
    sessionRef.current.subscription = sub;
  }, [targetConnection, customHost, pingInterval, pingMethod, loadInterstitial]);

  return (
    <ScrollView
      style={gs.screenContainer}
      contentContainerStyle={gs.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Connection Status Bar ────────────────────────── */}
      <ConnectionStatusBar />

      {/* ── Main Ping Card ───────────────────────────────── */}
      <View style={styles.pingCard}>
        {/* Radial glow background */}
        <View style={styles.pingGlow} />

        {/* Destination & Interval */}
        <View style={styles.destinationRow}>
          <TouchableOpacity
            style={styles.destinationWrap}
            activeOpacity={0.7}
            onPress={() => setConfigModalVisible(true)}
          >
            <Text style={[gs.labelCaps, styles.destinationLabel]}>Destination</Text>
            <View style={gs.chip}>
              <MaterialIcons name="public" size={14} color={Colors.primary} />
              <Text style={[gs.codeSm, { color: Colors.onSurface }]}>
                {targetConnection === 'Custom Host / IP' ? 'Custom' : targetConnection}
              </Text>
              <View style={[styles.methodBadge, { backgroundColor: pingMethod === 'icmp' ? 'rgba(120,220,119,0.15)' : 'rgba(255,167,38,0.15)' }]}>
                <MaterialIcons
                  name={pingMethod === 'icmp' ? 'network-check' : 'language'}
                  size={10}
                  color={pingMethod === 'icmp' ? Colors.tertiary : Colors.warning}
                />
                <Text style={[styles.methodBadgeText, { color: pingMethod === 'icmp' ? Colors.tertiary : Colors.warning }]}>
                  {pingMethod === 'icmp' ? 'ICMP' : 'HTTP'}
                </Text>
              </View>
              {pingInterval === RELAX_OPTION && (
                <View style={[styles.methodBadge, { backgroundColor: 'rgba(120,220,119,0.15)' }]}>
                  <MaterialIcons name="battery-saver" size={10} color={Colors.tertiary} />
                  <Text style={[styles.methodBadgeText, { color: Colors.tertiary }]}>RELAX</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.destinationDivider} />

          <TouchableOpacity
            style={styles.destinationWrap}
            activeOpacity={0.7}
            onPress={() => setConfigModalVisible(true)}
          >
            <Text style={[gs.labelCaps, styles.destinationLabel]}>Time</Text>
<View style={gs.chip}>
                <MaterialIcons name="timer" size={14} color={Colors.primary} />
                <Text style={[gs.codeSm, { color: Colors.onSurface }]}>
                  {pingInterval === RELAX_OPTION ? 'Battery Saver' : pingInterval}
                </Text>
              </View>
          </TouchableOpacity>
        </View>

        {/* Big Circular Ping & Start/Stop Button */}
        <TouchableOpacity
          style={styles.pingValueWrap}
          activeOpacity={0.8}
          onPress={() => (isPinging ? stopPing() : startPing())}
        >
          {/* Outer pulse ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              isPinging && styles.pulseRingOuterActive,
              { transform: [{ scale: pulseScale }] },
            ]}
          />
          {/* Inner pulse ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingInner,
              isPinging && styles.pulseRingInnerActive,
              { transform: [{ scale: pulseScale }], opacity: 0.3 },
            ]}
          />

          {/* Inside the circle */}
          <View style={styles.pingValueCenter}>
            {isPinging ? (
              <>
                <Text style={styles.pingNumber}>
                  {currentLatency !== null ? Math.round(currentLatency) : '--'}
                  <Text style={styles.pingUnit}>ms</Text>
                </Text>
                <View style={styles.stopIndicator}>
                  <MaterialIcons name="stop" size={12} color="#FF3B30" />
                  <Text style={styles.stopText}>STOP</Text>
                </View>
              </>
            ) : (
              <>
                {/* <MaterialIcons name="play-arrow" size={68} color={Colors.primary} style={{ marginBottom: 2 }} /> */}
                <Text style={styles.startTitle}>START</Text>
                <Text style={styles.startSubtitle}>TAP TO PING</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Settings shortcut ────────────────────────────── */}
      <TouchableOpacity
        style={styles.settingsRow}
        activeOpacity={0.7}
        onPress={() => setConfigModalVisible(true)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="tune" size={18} color={Colors.primary} />
          <Text style={[gs.bodyMd, { color: Colors.onSurface }]}>Target & Time Settings</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      {/* ── Battery optimization shortcut ─────────────────── */}
      {!batteryExempt && batteryModalDismissed && (
        <TouchableOpacity
          style={styles.settingsRow}
          activeOpacity={0.7}
          onPress={() => {
            refreshBatteryExempt();
            showBatteryModal();
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="battery-alert" size={18} color={Colors.warning} />
            <Text style={[gs.bodyMd, { color: Colors.onSurface }]}>Allow Background Run</Text>
          </View>
          <View style={[styles.methodBadge, { backgroundColor: 'rgba(255,167,38,0.15)' }]}>
            <Text style={[styles.methodBadgeText, { color: Colors.warning }]}>SET UP</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Statistics Grid ──────────────────────────────── */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatBox label="MIN" value={String(stats.min)} unit="ms" style={styles.statCell} />
          <StatBox label="AVG" value={String(stats.avg)} unit="ms" highlighted valueColor={Colors.primary} style={styles.statCell} />
          <StatBox label="MAX" value={String(stats.max)} unit="ms" style={styles.statCell} />
        </View>
        <View style={styles.statsRow}>
          <StatBox label="JITTER" value={String(stats.jitter)} unit="ms" style={styles.statCell} />
          <StatBox
            label="LOSS"
            value={`${stats.lossPct}%`}
            valueColor={stats.lossPct > 0 ? Colors.error : Colors.tertiary}
            style={styles.statCell}
          />
          <StatBox
            label="SUCCESS"
            value={`${stats.successPct}%`}
            valueColor={Colors.tertiary}
            style={styles.statCell}
          />
        </View>
      </View>

      {/* ── Packet Stats ─────────────────────────────────── */}
      <View style={styles.packetRow}>
        <View style={styles.packetStat}>
          <Text style={gs.labelCaps}>SENT </Text>
          <Text style={gs.codeSm}>{stats.sent}</Text>
        </View>
        <View style={styles.packetDivider} />
        <View style={styles.packetStat}>
          <Text style={gs.labelCaps}>RECV </Text>
          <Text style={gs.codeSm}>{stats.recv}</Text>
        </View>
        <View style={styles.packetDivider} />
        <View style={styles.packetStat}>
          <Text style={gs.labelCaps}>FAIL </Text>
          <Text style={[gs.codeSm, { color: Colors.error }]}>{stats.fail}</Text>
        </View>
      </View>

      {/* ── Ping Target & Timing Configuration Modal ──────────────── */}
      <Modal
        visible={configModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.configModalOverlay}
          activeOpacity={1}
          onPress={() => setConfigModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.cardModalContainer}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="tune" size={20} color={Colors.primary} />
                  <Text style={styles.cardTitle}>TARGET & TIMING</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setConfigModalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <SettingsRow label="Target Connection">
                <SimpleSelect
                  options={targetOptions}
                  selectedOption={targetConnection}
                  onSelect={setTargetConnection}
                />
              </SettingsRow>

              {targetConnection === 'Custom Host / IP' && (
                <View style={styles.customHostWrap}>
                  <Text style={styles.customHostLabel}>Custom IP or Hostname:</Text>
                  <TextInput
                    style={styles.customHostInput}
                    placeholder="e.g. 192.168.1.50 or https://example.com"
                    placeholderTextColor={Colors.outline}
                    value={customHost}
                    onChangeText={setCustomHost}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              <SettingsRow label="Ping Interval" bordered>
                <SimpleSelect
                  options={intervalOptions}
                  selectedOption={pingInterval}
                  onSelect={setPingInterval}
                />
              </SettingsRow>

              <SettingsRow label="Ping Method" bordered>
                <SimpleSelect
                  options={['ICMP (Recommended)', 'HTTP']}
                  selectedOption={pingMethod === 'icmp' ? 'ICMP (Recommended)' : 'HTTP'}
                  onSelect={(opt) => setPingMethod(opt === 'ICMP (Recommended)' ? 'icmp' : 'http')}
                />
              </SettingsRow>

              <TouchableOpacity
                style={[gs.btnPrimary, { marginTop: 16 }]}
                onPress={() => {
                  setConfigModalVisible(false);
                  // Restart the session so new settings take effect immediately
                  if (isPinging) startPing();
                }}
                activeOpacity={0.8}
              >
                <Text style={gs.btnPrimaryText}>Save & Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Ping Card ──────────────────────────────────────────
  pingCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.sectionMargin,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pingGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    backgroundColor: 'transparent',
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Spacing.sectionMargin,
  },
  destinationWrap: {
    flex: 1,
    alignItems: 'center',
  },
  destinationDivider: {
    width: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: 4,
  },
  destinationLabel: {
    marginBottom: 8,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 4,
  },
  methodBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Pulse value area / Big Circle Button ──────────────
  pingValueWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  pulseRingOuter: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: Colors.primaryContainer,
    opacity: 0.5,
  },
  pulseRingOuterActive: {
    borderColor: '#FF3B30',
    opacity: 0.85,
  },
  pulseRingInner: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceContainerHigh,
  },
  pulseRingInnerActive: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },
  pingValueCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingNumber: {
    fontSize: 44,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: Typography.headlineLg.fontFamily,
  },
  pingUnit: {
    fontSize: 20,
    fontWeight: '400',
    color: Colors.onSurfaceVariant,
    marginLeft: 2,
  },
  excellentBadge: {
    backgroundColor: 'rgba(120, 220, 119, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  excellentText: {
    ...Typography.labelCaps,
    fontSize: 10,
    color: Colors.tertiary,
  },
  startTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
    fontFamily: Typography.headlineLg.fontFamily,
  },
  startSubtitle: {
    ...Typography.labelCaps,
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
    letterSpacing: 1,
  },
  stopIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  stopText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: 0.5,
  },

  // ── Stats grid ─────────────────────────────────────────
  statsGrid: {
    gap: Spacing.unit,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.unit,
  },
  statCell: {
    flex: 1,
  },

  // ── Packet row ─────────────────────────────────────────
  packetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  packetStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packetDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.outlineVariant,
  },

  // ── Settings row ───────────────────────────────────────
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },

  // ── Modal & Select Styles ──────────────────────────────
  cardModalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  configModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 10,
    marginBottom: 8,
  },
  cardTitle: {
    ...Typography.labelCaps,
    color: Colors.onSurface,
  },
  customHostWrap: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  customHostLabel: {
    ...Typography.codeSm,
    color: Colors.onSurfaceVariant,
    marginBottom: 6,
  },
  customHostInput: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.onSurface,
    ...Typography.codeSm,
  },
});

