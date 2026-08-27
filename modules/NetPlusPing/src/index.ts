import { requireOptionalNativeModule } from 'expo-modules-core';

const NetPlusPing = requireOptionalNativeModule('NetPlusPing');

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


