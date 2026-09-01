import {
  ping as nativeIcmpPing,
  startContinuousPing,
  stopContinuousPing,
  getBackgroundStats,
} from 'netplus-ping';
import { dataUsageTracker } from '@/services/DataUsageTracker';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import SettingsRow from '@/components/SettingsRow';
import StatBox from '@/components/StatBox';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from '@/services/MobileAdsService';

// ── SimpleSelect dropdown modal helper ───────────────────
interface SimpleSelectProps {
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}

function SimpleSelect({ options, selectedOption, onSelect }: SimpleSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.selectTrigger}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectTriggerText}>{selectedOption}</Text>
        <MaterialIcons name="arrow-drop-down" size={18} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.selectModalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.selectModalContent}>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              initialNumToRender={8}
              maxToRenderPerBatch={10}
              windowSize={5}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item === selectedOption && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      item === selectedOption && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {item === selectedOption && (
                    <MaterialIcons name="check" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

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
const TARGET_HOSTS: Record<string, string> = {
  'Google': '8.8.8.8',
  'Google DNS': '8.8.8.8',
  'Hutch': 'hutch.lk',
  'Dialog': 'dialog.lk',
  'Mobitel': 'mobitel.lk',
  'Mobitel / SLT': 'mobitel.lk',
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
  timer?: ReturnType<typeof setTimeout>;
  tick?: () => void;
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
const AD_LOAD_ON_START = false;  // load ad when user taps START
const AD_LOAD_ON_END = true;    // load ad when user taps STOP (after showing)

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-5784306310827332/4228784926';
const interstitial = InterstitialAd.createForAdRequest(adUnitId);

function resolveHost(targetConnection: string, customHost: string): string {
  if (targetConnection === 'Custom Host / IP') {
    return sanitizeHost(customHost);
  }
  return sanitizeHost(TARGET_HOSTS[targetConnection] ?? '8.8.8.8');
}

function parseIntervalMs(option: string): number {
  const match = option.match(/\d+/);
  return match ? Number(match[0]) : 1000;
}

// Ping method types
type PingMethod = 'icmp' | 'http';

// ICMP ping via native NetPlusPing module (spawns the OS `ping` binary).
async function nativePing(host: string, timeoutMs: number): Promise<number | null> {
  const cleanHost = sanitizeHost(host);
  if (!cleanHost) return null;

  const probeTimeout = Math.max(timeoutMs, 3000);
  try {
    const res = await nativeIcmpPing(cleanHost, probeTimeout);
    if (typeof res === 'number' && !isNaN(res) && res > 0) {
      return res;
    }
    return null;
  } catch (err: any) {
    return null;
  }
}

// Latency is measured with an HTTP round-trip (GET/HEAD request) against the selected host.
async function httpPing(host: string, timeoutMs: number): Promise<number | null> {
  let cleanHost = sanitizeHost(host);
  if (!cleanHost) return null;

  const probeTimeout = Math.max(timeoutMs, 3000);

  // Directly map common target IP/domain presets to fast, non-redirecting HTTP endpoints
  let targetUrl = `https://${cleanHost}/`;
  if (cleanHost === '8.8.8.8' || cleanHost === '8.8.4.4' || cleanHost.includes('google')) {
    targetUrl = 'https://www.google.com/generate_204';
  } else if (cleanHost === '1.1.1.1' || cleanHost === '1.0.0.1' || cleanHost.includes('cloudflare')) {
    targetUrl = 'https://1.1.1.1/cdn-cgi/trace';
  }

  const startedAt = performance.now();

  // Attempt 1: Configured HTTPS endpoint
  try {
    const controller1 = new AbortController();
    const timer1 = setTimeout(() => controller1.abort(), probeTimeout);
    await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller1.signal,
    });
    clearTimeout(timer1);
    return Math.max(1, performance.now() - startedAt);
  } catch {
    // Attempt 2: Fallback to HTTP GET on host
    try {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), probeTimeout);
      await fetch(`http://${cleanHost}/`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller2.signal,
      });
      clearTimeout(timer2);
      return Math.max(1, performance.now() - startedAt);
    } catch {
      return null;
    }
  }
}

// Dispatch to ICMP (native `ping` binary with HTTP fallback) or HTTP method.
async function pingHost(host: string, timeoutMs: number, method: PingMethod): Promise<number | null> {
  if (!host) return null;
  if (method === 'icmp') {
    const icmpMs = await nativePing(host, timeoutMs);
    if (icmpMs !== null) return icmpMs;
    // Fallback to httpPing if native module unavailable (e.g. Expo Go)
    return httpPing(host, timeoutMs);
  }
  return httpPing(host, timeoutMs);
}

export default function PingingScreen() {
  const pulseScale = usePulse();

  // Ping Configuration State
  const [configModalVisible, setConfigModalVisible] = useState(false);
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
  const lastAdShowTime = useRef(0);

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
      .catch(() => {})
      .then(() => AsyncStorage.getItem(PING_METHOD_KEY))
      .then((method) => {
        if (method === 'icmp' || method === 'http') {
          setPingMethod(method as PingMethod);
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  // Save settings whenever they change (after initial load)
  useEffect(() => {
    if (!configLoaded) return;
    AsyncStorage.setItem(
      PING_CONFIG_KEY,
      JSON.stringify({ targetConnection, customHost, pingInterval })
    ).catch(() => {});
    AsyncStorage.setItem(PING_METHOD_KEY, pingMethod).catch(() => {});
  }, [configLoaded, targetConnection, customHost, pingInterval, pingMethod]);

  // Ad event listeners
  useEffect(() => {
    console.log('[AdMob] Registering interstitial ad event listeners...');
    const subs = [
      interstitial.addAdEventListener(AdEventType.LOADED, () => {
        console.log('[AdMob] Interstitial ad loaded successfully.');
        adLoaded.current = true;
      }),
      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('[AdMob] Interstitial ad was closed.');
        adLoaded.current = false;
        if (AD_LOAD_ON_END) {
          console.log('[AdMob] Preloading next interstitial ad...');
          interstitial.load();
        }
      }),
      interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.error('[AdMob] Interstitial ad failed to load:', error);
        adLoaded.current = false;
      }),
    ];
    if (AD_LOAD_ON_OPEN) {
      console.log('[AdMob] Loading interstitial ad...');
      interstitial.load();
    }
    return () => {
      console.log('[AdMob] Unregistering interstitial ad event listeners...');
      subs.forEach((s) => s());
    };
  }, []);

  const stopPing = useCallback(() => {
    sessionRef.current.active = false;
    if (sessionRef.current.timer) clearTimeout(sessionRef.current.timer);

    // Clean up native continuous ping service
    stopContinuousPing().catch(() => {});

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
      } catch (e: any) {
        console.warn('[AdMob] show() threw, reloading ad:', e?.message);
        interstitial.load();
      }
    } else {
      console.log(
        `[AdMob] Interstitial ad not shown. adLoaded: ${adLoaded.current}, cooldown remaining: ${Math.max(
          0,
          COOLDOWN_MS - (now - lastAdShowTime.current)
        )}ms`
      );
    }
    if (AD_LOAD_ON_END) {
      interstitial.load();
    }
  }, []);

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

  // Sync background stats and resume pinging immediately when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && sessionRef.current.active) {
        syncBackgroundStats();
        if (sessionRef.current.tick) {
          if (sessionRef.current.timer) clearTimeout(sessionRef.current.timer);
          sessionRef.current.tick();
        }
      }
    });
    return () => subscription.remove();
  }, [syncBackgroundStats]);

  const startPing = useCallback(() => {
    const host = resolveHost(targetConnection, customHost);
    if (!host) return;

    // Snapshot config so a running session isn't affected by edits
    const intervalMs = parseIntervalMs(pingInterval);
    // Requests are capped at MAX_PING_MS — anything slower counts as a loss
    const requestTimeoutMs = Math.min(Math.max(intervalMs * 2, 3000), MAX_PING_MS);

    // Stop any existing JS-side ping loop/timer, but do NOT stop the
    // native foreground service here — the new startContinuousPing()
    // intent will override the running service's parameters directly,
    // avoiding a STOP→START race that kills the service before it
    // can promote to foreground.
    sessionRef.current.active = false;
    if (sessionRef.current.timer) clearTimeout(sessionRef.current.timer);

    dataUsageTracker.setPingingActive(true);
    latenciesRef.current = [];
    setCurrentLatency(null);
    setStats(EMPTY_STATS);
    setIsPinging(true);
    if (AD_LOAD_ON_START) {
      interstitial.load();
    }

    const session: PingSession = { active: true };
    sessionRef.current = session;

    // Start native continuous ping service with WakeLock and persistent notification
    startContinuousPing(
      host,
      intervalMs,
      requestTimeoutMs,
      pingMethod,
      'NetPlus Continuous Monitor',
      `Pinging ${host} every ${pingInterval}`
    ).catch(() => {});

    const tick = async () => {
      if (!session.active) return;
      const startTime = Date.now();

      const latencyRaw = await pingHost(host, requestTimeoutMs, pingMethod);
      const latency =
        latencyRaw !== null ? Math.min(Math.round(latencyRaw), MAX_PING_MS) : null;
      console.log(`[Ping] Target: ${host} | Method: ${pingMethod.toUpperCase()} | Result: ${latency !== null ? `${latency} ms` : 'FAILED'}`);
      if (!session.active) return; // stopped while in flight

      dataUsageTracker.recordPingResult(latency !== null);

      if (latency === null) {
        setCurrentLatency(null);
        setStats((prev) => {
          const sent = prev.sent + 1;
          const fail = prev.fail + 1;
          return {
            ...prev,
            sent,
            fail,
            lossPct: Math.round((fail / sent) * 100),
            successPct: Math.round(((sent - fail) / sent) * 100),
          };
        });
      } else {
        setCurrentLatency(latency);
        const samples = [...latenciesRef.current, latency];
        latenciesRef.current = samples;
        setStats((prev) => {
          const sent = prev.sent + 1;
          const recv = prev.recv + 1;
          let jitterSum = 0;
          for (let i = 1; i < samples.length; i++) {
            jitterSum += Math.abs(samples[i] - samples[i - 1]);
          }
          return {
            ...prev,
            sent,
            recv,
            min: Math.round(Math.min(...samples)),
            max: Math.round(Math.max(...samples)),
            avg: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
            jitter:
              samples.length > 1
                ? Math.round(jitterSum / (samples.length - 1))
                : prev.jitter,
            lossPct: Math.round((prev.fail / sent) * 100),
            successPct: Math.round((recv / sent) * 100),
          };
        });
      }

      if (session.active) {
        const elapsed = Date.now() - startTime;
        const nextDelay = Math.max(100, intervalMs - elapsed);
        session.timer = setTimeout(tick, nextDelay);
      }
    };

    session.tick = tick;
    tick();
  }, [targetConnection, customHost, pingInterval, pingMethod, stopPing]);

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
                {pingInterval}
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

      {/* ── Latency Graph ────────────────────────────────── */}
      {/* <View style={styles.graphCard}>
        <View style={styles.graphHeader}>
          <Text style={gs.labelCaps}>LATENCY (LAST 60S)</Text>
          <View style={styles.graphLegend}>
            <View style={[styles.legendDot, { backgroundColor: Colors.tertiary }]} />
            <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
          </View>
        </View>
        <View style={styles.graphArea}>
          
          {[40, 42, 38, 45, 85, 41, 39, 42].map((val, i) => {
            const isSpike = val > 60;
            return (
              <View
                key={i}
                style={[
                  styles.graphBar,
                  {
                    height: `${val}%`,
                    backgroundColor: isSpike
                      ? 'rgba(255, 167, 38, 0.4)'
                      : 'rgba(173, 198, 255, 0.2)',
                  },
                ]}
              />
            );
          })}


          <View style={[styles.thresholdLine, { bottom: '60%', borderColor: 'rgba(255, 167, 38, 0.3)' }]} />
          <View style={[styles.thresholdLine, { bottom: '80%', borderColor: 'rgba(255, 180, 171, 0.3)' }]} />
        </View>
      </View> */}

      {/* ── Recent Sessions ──────────────────────────────── */}
      {/* <View style={styles.sessionsSection}>
        <Text style={[gs.labelCaps, { marginBottom: 8 }]}>RECENT SESSIONS</Text>
        <TouchableOpacity style={styles.sessionItem} activeOpacity={0.7}>
          <View style={styles.sessionLeft}>
            <View style={styles.sessionIcon}>
              <MaterialIcons name="history" size={22} color={Colors.onSurface} />
            </View>
            <View>
              <Text style={[gs.bodyMd, { fontWeight: '600', color: Colors.onSurface }]}>
                Google DNS
              </Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>
                Today, 14:20
              </Text>
            </View>
          </View>
          <View style={styles.sessionRight}>
            <Text style={[gs.codeSm, { color: Colors.primary }]}>Avg: 41ms</Text>
            <View style={styles.sessionLoss}>
              <Text style={gs.labelCaps}>Loss: 0%</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.tertiary }]} />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sessionItem, { opacity: 0.7 }]} activeOpacity={0.7}>
          <View style={styles.sessionLeft}>
            <View style={styles.sessionIcon}>
              <MaterialIcons name="sports-esports" size={22} color={Colors.onSurface} />
            </View>
            <View>
              <Text style={[gs.bodyMd, { fontWeight: '600', color: Colors.onSurface }]}>
                Game Server
              </Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>
                Yesterday, 21:05
              </Text>
            </View>
          </View>
          <View style={styles.sessionRight}>
            <Text style={[gs.codeSm, { color: Colors.warning }]}>Avg: 112ms</Text>
            <View style={styles.sessionLoss}>
              <Text style={gs.labelCaps}>Loss: 2%</Text>
              <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            </View>
          </View>
        </TouchableOpacity>
      </View> */}

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

  // ── Latency Graph ──────────────────────────────────────
  graphCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
    height: 200,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  graphLegend: {
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  graphArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    backgroundColor: Colors.surfaceDim,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  graphBar: {
    flex: 1,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  thresholdLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },

  // ── Recent Sessions ────────────────────────────────────
  sessionsSection: {
    gap: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.default,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionLoss: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
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
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  selectTriggerText: {
    ...Typography.codeSm,
    color: Colors.onSurface,
  },
  selectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectModalContent: {
    width: '80%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOptionSelected: {
    backgroundColor: Colors.surfaceBright,
  },
  modalOptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  modalOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
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

