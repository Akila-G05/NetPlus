import { requireOptionalNativeModule, EventEmitter } from 'expo-modules-core';

const NetPlusPing = requireOptionalNativeModule('NetPlusPing');
const emitter = NetPlusPing ? new EventEmitter(NetPlusPing) : null;

export interface PingResultEvent {
  host: string;
  latency: number;
  sent: number;
  recv: number;
  fail: number;
  /** Outcome label for the last probe, e.g. "ICMP", "HTTP 200", "HTTP 403", "Timeout". */
  reason?: string;
}

export interface BackgroundPingStats {
  isRunning: boolean;
  sent: number;
  recv: number;
  fail: number;
  min: number;
  max: number;
  avg: number;
  lastLatency: number;
  jitter: number;
}

export interface SpeedTestProgressEvent {
  phase: number;
  currentMbps: number;
  pingMs: number;
  downloadMbps: number;
  uploadMbps: number;
}

export interface SpeedTestResult {
  isRunning: boolean;
  phase: number;
  currentMbps: number;
  pingMs: number;
  downloadMbps: number;
  uploadMbps: number;
  serverName: string;
}

export const SpeedTestPhase = {
  PING: 0,
  DOWNLOAD: 1,
  UPLOAD: 2,
  COMPLETE: 3,
} as const;

export function isNetPlusPingAvailable(): boolean {
  return !!NetPlusPing && typeof NetPlusPing.ping === 'function';
}

export async function ping(host: string, timeoutMs: number = 3000): Promise<number | null> {
  if (!NetPlusPing || typeof NetPlusPing.ping !== 'function') {
    console.log('[NetPlusPing] Native module unavailable. (Run `npx expo run:android` to rebuild native binary)');
    return null;
  }
  try {
    return await NetPlusPing.ping(host, timeoutMs);
  } catch (err: any) {
    console.log('[NetPlusPing] Native execution error:', err?.message || err);
    return null;
  }
}

export async function startContinuousPing(
  host: string,
  intervalMs: number = 1000,
  timeoutMs: number = 3000,
  method: string = 'http',
  title: string = 'NetPlus Continuous Monitor',
  body: string = 'Pinging...',
  relaxMode: boolean = false,
): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.startContinuousPing !== 'function') return false;
  try {
    return await NetPlusPing.startContinuousPing(host, intervalMs, timeoutMs, method, title, body, relaxMode);
  } catch {
    return false;
  }
}

export async function stopContinuousPing(): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.stopContinuousPing !== 'function') return false;
  try {
    return await NetPlusPing.stopContinuousPing();
  } catch {
    return false;
  }
}

export async function getBackgroundStats(): Promise<BackgroundPingStats | null> {
  if (!NetPlusPing || typeof NetPlusPing.getBackgroundStats !== 'function') return null;
  try {
    return await NetPlusPing.getBackgroundStats();
  } catch {
    return null;
  }
}

export function addPingResultListener(listener: (event: PingResultEvent) => void) {
  if (!emitter) return { remove: () => {} };
  // EventEmitter is typed with an empty default event map; scope the cast to
  // the call so event names stay plain strings.
  return (emitter as any).addListener('onPingResult', listener);
}

// ── Background speed test ─────────────────────────────────────

export async function startSpeedTestInBackground(
  pingEndpoint: string,
  downloadEndpoint: string,
  uploadEndpoint: string,
  serverName: string,
  title: string = 'NetPlus Speed Test',
  body: string = 'Running speed test...'
): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.startSpeedTest !== 'function') return false;
  try {
    return await NetPlusPing.startSpeedTest(pingEndpoint, downloadEndpoint, uploadEndpoint, serverName, title, body);
  } catch {
    return false;
  }
}

export async function stopSpeedTestInBackground(): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.stopSpeedTest !== 'function') return false;
  try {
    return await NetPlusPing.stopSpeedTest();
  } catch {
    return false;
  }
}

export async function getSpeedTestResult(): Promise<SpeedTestResult | null> {
  if (!NetPlusPing || typeof NetPlusPing.getSpeedTestResult !== 'function') return null;
  try {
    return await NetPlusPing.getSpeedTestResult();
  } catch {
    return null;
  }
}

export function addSpeedTestProgressListener(listener: (event: SpeedTestProgressEvent) => void) {
  if (!emitter) return { remove: () => {} };
  return (emitter as any).addListener('onSpeedTestProgress', listener);
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.isIgnoringBatteryOptimizations !== 'function') return false;
  try {
    return !!(await NetPlusPing.isIgnoringBatteryOptimizations());
  } catch {
    return false;
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.requestIgnoreBatteryOptimizations !== 'function') return false;
  try {
    return !!(await NetPlusPing.requestIgnoreBatteryOptimizations());
  } catch {
    return false;
  }
}

export async function openBatteryOptimizationSettings(): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.openBatteryOptimizationSettings !== 'function') return false;
  try {
    return !!(await NetPlusPing.openBatteryOptimizationSettings());
  } catch {
    return false;
  }
}
