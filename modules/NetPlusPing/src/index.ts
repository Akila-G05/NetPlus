import { requireOptionalNativeModule, EventEmitter } from 'expo-modules-core';

const NetPlusPing = requireOptionalNativeModule('NetPlusPing');
const emitter = NetPlusPing ? new EventEmitter(NetPlusPing) : null;

export interface PingResultEvent {
  host: string;
  latency: number;
  sent: number;
  recv: number;
  fail: number;
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
}

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
  body: string = 'Pinging...'
): Promise<boolean> {
  if (!NetPlusPing || typeof NetPlusPing.startContinuousPing !== 'function') return false;
  try {
    return await NetPlusPing.startContinuousPing(host, intervalMs, timeoutMs, method, title, body);
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
  return (emitter as any).addListener('onPingResult', listener);
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
