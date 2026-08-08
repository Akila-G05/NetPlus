import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import StatBox from '@/components/StatBox';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';

type PingSample = { id: number; latency: number | null };
type Target = { name: string; url: string; kind: 'internet' | 'local' };

const PRESETS: Target[] = [
  { name: 'Google', url: 'https://www.google.com/generate_204', kind: 'internet' },
  { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace', kind: 'internet' },
  { name: 'Local Router', url: 'http://192.168.1.1', kind: 'local' },
];

const INTERVALS = [1000, 5000, 10000];

function qualityFor(latency: number | null, loss: number) {
  if (latency === null) return { label: 'READY', color: Colors.onSurfaceVariant };
  if (loss >= 20 || latency > 250) return { label: 'POOR', color: Colors.error };
  if (loss >= 5 || latency > 120) return { label: 'FAIR', color: Colors.warning };
  if (latency > 60) return { label: 'GOOD', color: Colors.primary };
  return { label: 'EXCELLENT', color: Colors.tertiary };
}

export default function PingingScreen() {
  const [target, setTarget] = useState<Target>(PRESETS[0]);
  const [draftName, setDraftName] = useState(PRESETS[0].name);
  const [draftUrl, setDraftUrl] = useState(PRESETS[0].url);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [continuous, setContinuous] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Ready to test');
  const [samples, setSamples] = useState<PingSample[]>([]);

  const runningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sampleId = useRef(0);
  const pulse = useRef(new Animated.Value(1)).current;

  const stopPing = (message = 'Test stopped') => {
    runningRef.current = false;
    setRunning(false);
    setStatus(message);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const pingOnce = async () => {
    if (!runningRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    let latency: number | null = null;

    try {
      const separator = target.url.includes('?') ? '&' : '?';
      await fetch(`${target.url}${separator}netplus=${started}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      latency = Date.now() - started;
      setStatus(`Reply from ${target.name}`);
    } catch {
      setStatus('Request timed out or target is unreachable');
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      sampleId.current += 1;
      setSamples((current) => [...current.slice(-59), { id: sampleId.current, latency }]);
    }

    if (!runningRef.current) return;
    if (!continuous && sampleId.current >= 10) {
      stopPing('10 requests completed');
      return;
    }
    timerRef.current = setTimeout(pingOnce, intervalMs);
  };

  const startPing = () => {
    setSamples([]);
    sampleId.current = 0;
    runningRef.current = true;
    setRunning(true);
    setStatus('Sending request…');
    void pingOnce();
  };

  useEffect(() => () => stopPing('Ready to test'), []);

  useEffect(() => {
    if (!running) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, running]);

  const metrics = useMemo(() => {
    const successful = samples.flatMap((sample) => sample.latency === null ? [] : [sample.latency]);
    const sent = samples.length;
    const received = successful.length;
    const failed = sent - received;
    const avg = received ? Math.round(successful.reduce((a, b) => a + b, 0) / received) : null;
    const min = received ? Math.min(...successful) : null;
    const max = received ? Math.max(...successful) : null;
    const differences = successful.slice(1).map((value, index) => Math.abs(value - successful[index]));
    const jitter = differences.length
      ? Math.round(differences.reduce((a, b) => a + b, 0) / differences.length)
      : 0;
    const loss = sent ? Math.round((failed / sent) * 100) : 0;
    const success = sent ? Math.round((received / sent) * 100) : 0;
    return { sent, received, failed, avg, min, max, jitter, loss, success };
  }, [samples]);

  const lastLatency = [...samples].reverse().find((sample) => sample.latency !== null)?.latency ?? null;
  const quality = qualityFor(lastLatency, metrics.loss);
  const graphSamples = samples.slice(-24);
  const graphCeiling = Math.max(150, ...graphSamples.map((item) => item.latency ?? 150));

  const saveTarget = () => {
    const cleaned = draftUrl.trim();
    if (!/^https?:\/\//i.test(cleaned)) {
      setStatus('Target must begin with http:// or https://');
      return;
    }
    setTarget({
      name: draftName.trim() || 'Custom Target',
      url: cleaned,
      kind: /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(cleaned) ? 'local' : 'internet',
    });
    setTargetOpen(false);
    setStatus('Target updated');
  };

  return (
    <>
      <ScrollView
        style={gs.screenContainer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ConnectionStatusBar />

        <View style={styles.modeNotice}>
          <MaterialIcons name="lan" size={18} color={Colors.secondary} />
          <View style={styles.noticeText}>
            <Text style={styles.noticeTitle}>Request latency mode</Text>
            <Text style={styles.noticeBody}>Direct HTTP/HTTPS requests from this phone; no backend is used.</Text>
          </View>
        </View>

        <View style={styles.pingCard}>
          <Text style={styles.label}>DESTINATION</Text>
          <TouchableOpacity
            style={styles.destination}
            onPress={() => {
              setDraftName(target.name);
              setDraftUrl(target.url);
              setTargetOpen(true);
            }}
            disabled={running}
          >
            <MaterialIcons name={target.kind === 'local' ? 'router' : 'public'} size={16} color={Colors.primary} />
            <View style={styles.destinationText}>
              <Text style={styles.targetName}>{target.name}</Text>
              <Text style={styles.targetUrl} numberOfLines={1}>{target.url}</Text>
            </View>
            <MaterialIcons name="expand-more" size={20} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.pingValueWrap}>
            <Animated.View style={[styles.outerRing, { transform: [{ scale: pulse }] }]} />
            <View style={styles.innerRing} />
            <View style={styles.pingCenter}>
              <Text style={[styles.pingValue, { color: quality.color }]}>
                {lastLatency ?? '—'}
                {lastLatency !== null && <Text style={styles.pingUnit}> ms</Text>}
              </Text>
              <View style={[styles.qualityBadge, { borderColor: quality.color }]}>
                <Text style={[styles.qualityText, { color: quality.color }]}>{quality.label}</Text>
              </View>
              <Text style={styles.statusText} numberOfLines={2}>{status}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, running && styles.stopButton]}
            onPress={() => running ? stopPing() : startPing()}
          >
            <MaterialIcons name={running ? 'stop' : 'play-arrow'} size={23} color={running ? Colors.error : Colors.onPrimary} />
            <Text style={[styles.primaryButtonText, running && { color: Colors.error }]}>
              {running ? 'Stop Ping' : 'Start Ping'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatBox label="MIN" value={metrics.min?.toString() ?? '—'} unit={metrics.min === null ? undefined : 'ms'} style={styles.statCell} />
            <StatBox label="AVG" value={metrics.avg?.toString() ?? '—'} unit={metrics.avg === null ? undefined : 'ms'} highlighted valueColor={Colors.primary} style={styles.statCell} />
            <StatBox label="MAX" value={metrics.max?.toString() ?? '—'} unit={metrics.max === null ? undefined : 'ms'} style={styles.statCell} />
          </View>
          <View style={styles.statsRow}>
            <StatBox label="JITTER" value={metrics.jitter.toString()} unit="ms" style={styles.statCell} />
            <StatBox label="LOSS" value={`${metrics.loss}%`} valueColor={metrics.loss ? Colors.error : Colors.tertiary} style={styles.statCell} />
            <StatBox label="SUCCESS" value={`${metrics.success}%`} valueColor={Colors.tertiary} style={styles.statCell} />
          </View>
        </View>

        <View style={styles.packetRow}>
          <PacketStat label="SENT" value={metrics.sent} />
          <View style={styles.divider} />
          <PacketStat label="RECV" value={metrics.received} />
          <View style={styles.divider} />
          <PacketStat label="FAIL" value={metrics.failed} error={metrics.failed > 0} />
        </View>

        <TouchableOpacity style={styles.settingsHeader} onPress={() => setSettingsOpen((open) => !open)}>
          <View style={styles.rowStart}>
            <MaterialIcons name="tune" size={19} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Ping Settings</Text>
          </View>
          <MaterialIcons name={settingsOpen ? 'expand-less' : 'expand-more'} size={22} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {settingsOpen && (
          <View style={styles.settingsCard}>
            <Text style={styles.label}>INTERVAL</Text>
            <View style={styles.segmentRow}>
              {INTERVALS.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.segment, intervalMs === value && styles.segmentActive]}
                  onPress={() => setIntervalMs(value)}
                  disabled={running}
                >
                  <Text style={[styles.segmentText, intervalMs === value && styles.segmentTextActive]}>{value / 1000}s</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingTitle}>Request timeout</Text>
                <Text style={styles.settingCaption}>Mark unreachable after {timeoutMs / 1000} seconds</Text>
              </View>
              <TouchableOpacity onPress={() => !running && setTimeoutMs(timeoutMs === 5000 ? 10000 : 5000)}>
                <Text style={styles.settingValue}>{timeoutMs / 1000}s</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingTitle}>Continuous ping</Text>
                <Text style={styles.settingCaption}>{continuous ? 'Runs until stopped' : 'Stops after 10 requests'}</Text>
              </View>
              <Switch
                value={continuous}
                onValueChange={setContinuous}
                disabled={running}
                trackColor={{ false: Colors.surfaceContainerHighest, true: Colors.primaryContainer }}
                thumbColor={Colors.primary}
              />
            </View>
          </View>
        )}

        <View style={styles.graphCard}>
          <View style={styles.graphHeader}>
            <View>
              <Text style={styles.label}>LATENCY</Text>
              <Text style={styles.graphSubtext}>Last {graphSamples.length || 0} requests</Text>
            </View>
            <View style={styles.legend}>
              <Legend color={Colors.tertiary} text="Good" />
              <Legend color={Colors.warning} text="Slow" />
              <Legend color={Colors.error} text="Failed" />
            </View>
          </View>
          <View style={styles.graphArea}>
            {graphSamples.length === 0 ? (
              <View style={styles.emptyGraph}>
                <MaterialIcons name="show-chart" size={28} color={Colors.outline} />
                <Text style={styles.emptyText}>Start a test to see live latency</Text>
              </View>
            ) : graphSamples.map((sample) => {
              const failed = sample.latency === null;
              const value = sample.latency ?? graphCeiling;
              const color = failed ? Colors.error : value > 120 ? Colors.warning : Colors.primary;
              return (
                <View key={sample.id} style={styles.barSlot}>
                  <View style={[styles.graphBar, { height: `${Math.max(8, (value / graphCeiling) * 100)}%`, backgroundColor: color }]} />
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.helpCard}>
          <MaterialIcons name="info-outline" size={20} color={Colors.primary} />
          <Text style={styles.helpText}>
            For a local device, enter an address that serves HTTP, such as http://192.168.1.1. True ICMP ping requires a native development build.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={targetOpen} transparent animationType="slide" onRequestClose={() => setTargetOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTargetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose destination</Text>
            <Text style={styles.sheetCaption}>Select a preset or enter a reachable HTTP/HTTPS endpoint.</Text>

            {PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.url}
                style={styles.presetRow}
                onPress={() => {
                  setDraftName(preset.name);
                  setDraftUrl(preset.url);
                }}
              >
                <MaterialIcons name={preset.kind === 'local' ? 'router' : 'public'} size={21} color={Colors.primary} />
                <View style={styles.presetText}>
                  <Text style={styles.settingTitle}>{preset.name}</Text>
                  <Text style={styles.targetUrl} numberOfLines={1}>{preset.url}</Text>
                </View>
                {draftUrl === preset.url && <MaterialIcons name="check-circle" size={21} color={Colors.tertiary} />}
              </TouchableOpacity>
            ))}

            <Text style={styles.inputLabel}>NAME</Text>
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Home Router"
              placeholderTextColor={Colors.outline}
            />
            <Text style={styles.inputLabel}>HTTP/HTTPS ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={draftUrl}
              onChangeText={setDraftUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.1"
              placeholderTextColor={Colors.outline}
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelAction} onPress={() => setTargetOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveAction} onPress={saveTarget}>
                <Text style={styles.saveText}>Use Target</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function PacketStat({ label, value, error = false }: { label: string; value: number; error?: boolean }) {
  return (
    <View style={styles.packetStat}>
      <Text style={styles.label}>{label} </Text>
      <Text style={[styles.code, error && { color: Colors.error }]}>{value}</Text>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.containerPadding, paddingBottom: 32, gap: 12 },
  modeNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: BorderRadius.md, backgroundColor: 'rgba(0, 227, 253, 0.07)', borderWidth: 1, borderColor: 'rgba(0, 227, 253, 0.2)' },
  noticeText: { flex: 1 },
  noticeTitle: { ...Typography.bodyMd, color: Colors.secondary, fontWeight: '700' },
  noticeBody: { ...Typography.codeSm, color: Colors.onSurfaceVariant, marginTop: 2 },
  pingCard: { backgroundColor: Colors.surfaceContainer, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 16, alignItems: 'center' },
  label: { ...Typography.labelCaps, color: Colors.onSurfaceVariant },
  destination: { flexDirection: 'row', alignItems: 'center', gap: 9, width: '100%', marginTop: 8, padding: 10, backgroundColor: Colors.surfaceContainerHigh, borderRadius: BorderRadius.default, borderWidth: 1, borderColor: Colors.outlineVariant },
  destinationText: { flex: 1 },
  targetName: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '700' },
  targetUrl: { ...Typography.codeSm, color: Colors.onSurfaceVariant },
  pingValueWrap: { width: 196, height: 196, alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  outerRing: { position: 'absolute', width: 184, height: 184, borderRadius: 92, borderWidth: 2, borderColor: Colors.primaryContainer, opacity: 0.55 },
  innerRing: { position: 'absolute', width: 158, height: 158, borderRadius: 79, borderWidth: 1, borderColor: Colors.outlineVariant },
  pingCenter: { width: 140, alignItems: 'center' },
  pingValue: { fontFamily: Typography.headlineLg.fontFamily, fontSize: 48, fontWeight: '700' },
  pingUnit: { ...Typography.codeLg, color: Colors.onSurfaceVariant },
  qualityBadge: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  qualityText: { ...Typography.labelCaps, fontSize: 9 },
  statusText: { ...Typography.codeSm, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
  primaryButton: { width: '100%', minHeight: 48, borderRadius: BorderRadius.default, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  stopButton: { backgroundColor: 'rgba(255, 180, 171, 0.08)', borderWidth: 1, borderColor: Colors.error },
  primaryButtonText: { ...Typography.bodyLg, color: Colors.onPrimary, fontWeight: '700' },
  statsGrid: { gap: 4 },
  statsRow: { flexDirection: 'row', gap: 4 },
  statCell: { flex: 1 },
  packetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.default, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 10 },
  packetStat: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 16, width: 1, backgroundColor: Colors.outlineVariant },
  code: { ...Typography.codeSm, color: Colors.onSurface },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.default, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 13 },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '700' },
  settingsCard: { backgroundColor: Colors.surfaceContainer, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 14, gap: 12 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: BorderRadius.default, alignItems: 'center', backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  segmentActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { ...Typography.codeSm, color: Colors.onSurfaceVariant },
  segmentTextActive: { color: Colors.onPrimary, fontWeight: '700' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.outlineVariant, paddingTop: 12 },
  settingTitle: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '600' },
  settingCaption: { ...Typography.codeSm, color: Colors.onSurfaceVariant, marginTop: 2 },
  settingValue: { ...Typography.codeLg, color: Colors.primary, padding: 8 },
  graphCard: { height: 214, backgroundColor: Colors.surfaceContainer, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 14 },
  graphHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  graphSubtext: { ...Typography.codeSm, color: Colors.onSurfaceVariant },
  legend: { flexDirection: 'row', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { ...Typography.labelCaps, fontSize: 8, color: Colors.onSurfaceVariant },
  graphArea: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: Colors.surfaceDim, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.outlineVariant, paddingHorizontal: 5, paddingTop: 8, overflow: 'hidden' },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  graphBar: { width: '100%', minWidth: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.72 },
  emptyGraph: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyText: { ...Typography.bodyMd, color: Colors.outline },
  helpCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant },
  helpText: { ...Typography.codeSm, color: Colors.onSurfaceVariant, flex: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { backgroundColor: Colors.surfaceContainer, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 20, paddingBottom: 30 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.outline, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { ...Typography.headlineMd, color: Colors.onSurface },
  sheetCaption: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 4, marginBottom: 12 },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  presetText: { flex: 1 },
  inputLabel: { ...Typography.labelCaps, color: Colors.onSurfaceVariant, marginTop: 14, marginBottom: 5 },
  input: { minHeight: 46, borderRadius: BorderRadius.default, borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerHigh, color: Colors.onSurface, paddingHorizontal: 12, ...Typography.codeLg },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelAction: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.default, borderWidth: 1, borderColor: Colors.outlineVariant },
  cancelText: { ...Typography.bodyMd, color: Colors.onSurface, fontWeight: '700' },
  saveAction: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.default, backgroundColor: Colors.primary },
  saveText: { ...Typography.bodyMd, color: Colors.onPrimary, fontWeight: '700' },
});
