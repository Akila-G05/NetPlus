/**
 * DataUsageTracker — JS-level network traffic meter.
 *
 * Patches the global `fetch` to count request body bytes (sent)
 * and response content-length / body bytes (received) for every
 * network call made by NetPulse. No Android permissions required.
 *
 * Usage:
 *   import { dataUsageTracker } from '@/services/DataUsageTracker';
 *   dataUsageTracker.init();          // call once at app start
 *   dataUsageTracker.startSession('ping');
 *   // … network calls happen …
 *   dataUsageTracker.endSession();
 *   const stats = dataUsageTracker.getStats();
 */

export type SessionType = 'ping' | 'speedtest' | 'idle';

export interface SessionStat {
  type: SessionType;
  sentBytes: number;
  receivedBytes: number;
  startedAt: number;
  endedAt?: number;
}

export interface DataUsageStats {
  totalSentBytes: number;
  totalReceivedBytes: number;
  sessions: SessionStat[];
  currentSession: SessionStat | null;
}

class DataUsageTracker {
  private totalSent = 0;
  private totalReceived = 0;
  private sessions: SessionStat[] = [];
  private currentSession: SessionStat | null = null;
  private initialized = false;
  private originalFetch: typeof fetch = global.fetch;
  private listeners: (() => void)[] = [];
  private trafficBuffer: { timestamp: number; sent: number; received: number }[] = [];

  // ── Public API ─────────────────────────────────────────

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.originalFetch = global.fetch.bind(global);
    const tracker = this;
    global.fetch = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      // ── Measure outgoing bytes ───────────────────────
      let sentBytes = 0;
      const body = init?.body;
      if (typeof body === 'string') {
        sentBytes = new TextEncoder().encode(body).byteLength;
      } else if (body instanceof ArrayBuffer) {
        sentBytes = body.byteLength;
      } else if (body instanceof Uint8Array) {
        sentBytes = body.byteLength;
      }

      try {
        const response = await tracker.originalFetch(input, init);

        // ── Measure incoming bytes ────────────────────
        // Clone so the original stream isn't consumed
        const cloned = response.clone();
        cloned.arrayBuffer().then((buf) => {
          const receivedBytes = buf.byteLength || 0;
          tracker.record(sentBytes, receivedBytes);
        }).catch(() => {
          // Content-Length fallback
          const cl = response.headers.get('content-length');
          if (cl) tracker.record(sentBytes, parseInt(cl, 10));
          else tracker.record(sentBytes, 0);
        });

        return response;
      } catch (err) {
        tracker.record(sentBytes, 0);
        throw err;
      }
    };
  }

  startSession(type: SessionType) {
    if (this.currentSession && !this.currentSession.endedAt) {
      this.endSession();
    }
    this.currentSession = {
      type,
      sentBytes: 0,
      receivedBytes: 0,
      startedAt: Date.now(),
    };
  }

  endSession() {
    if (!this.currentSession) return;
    this.currentSession.endedAt = Date.now();
    this.sessions.push({ ...this.currentSession });
    // Keep only last 100 sessions
    if (this.sessions.length > 100) this.sessions.shift();
    this.currentSession = null;
  }

  reset() {
    this.totalSent = 0;
    this.totalReceived = 0;
    this.sessions = [];
    this.currentSession = null;
    this.trafficBuffer = [];
    this.notifyListeners();
  }

  getStats(): DataUsageStats {
    return {
      totalSentBytes: this.totalSent,
      totalReceivedBytes: this.totalReceived,
      sessions: [...this.sessions],
      currentSession: this.currentSession ? { ...this.currentSession } : null,
    };
  }

  getLiveRate(windowMs = 2000): { rxBytesPerSec: number; txBytesPerSec: number } {
    const now = Date.now();
    const cutoff = now - windowMs;
    // Prune old entries
    this.trafficBuffer = this.trafficBuffer.filter((t) => t.timestamp >= now - 5000);
    const windowEntries = this.trafficBuffer.filter((t) => t.timestamp >= cutoff);

    const totalRx = windowEntries.reduce((sum, t) => sum + t.received, 0);
    const totalTx = windowEntries.reduce((sum, t) => sum + t.sent, 0);

    const timeSec = windowMs / 1000;
    return {
      rxBytesPerSec: totalRx / timeSec,
      txBytesPerSec: totalTx / timeSec,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ── Internals ──────────────────────────────────────────

  private record(sent: number, received: number) {
    this.totalSent += sent;
    this.totalReceived += received;
    this.trafficBuffer.push({ timestamp: Date.now(), sent, received });

    if (this.currentSession) {
      this.currentSession.sentBytes += sent;
      this.currentSession.receivedBytes += received;
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }
}

export const dataUsageTracker = new DataUsageTracker();

// ── Formatting helpers ───────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeedRate(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  const mbps = (bytesPerSec * 8) / 1_000_000;
  if (mbps >= 10) return `${mbps.toFixed(1)} Mbps`;
  return `${mbps.toFixed(2)} Mbps`;
}
