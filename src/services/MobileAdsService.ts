import { NativeModules } from 'react-native';
import TurboModuleRegistry from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

// Safe check if native module exists
let isAdmobAvailable = false;
try {
  isAdmobAvailable =
    !!NativeModules.RNGoogleMobileAdsModule ||
    !!TurboModuleRegistry.get('RNGoogleMobileAdsModule');
} catch {
  isAdmobAvailable = false;
}

let MobileAds: any;
let InterstitialAd: any;
let AdEventType: any;
let TestIds: any;

if (isAdmobAvailable) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ads = require('react-native-google-mobile-ads');
    MobileAds = ads.default || ads.MobileAds || ads.mobileAds;
    InterstitialAd = ads.InterstitialAd;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;
  } catch (error) {
    console.warn('Failed to load react-native-google-mobile-ads even though native module exists:', error);
    isAdmobAvailable = false;
  }
}

if (!isAdmobAvailable) {
  // Mock implementations to prevent crashing in Expo Go
  MobileAds = () => ({
    initialize: () => {
      console.log('[MobileAds Mock] initialized (no-op in Expo Go)');
      return Promise.resolve({});
    },
  });

  // Mock AdEventType enum
  AdEventType = {
    LOADED: 'loaded',
    CLOSED: 'closed',
    ERROR: 'error',
    OPENED: 'opened',
    CLICKED: 'clicked',
  };

  // Mock TestIds
  TestIds = {
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  };

  // Mock InterstitialAd class
  class MockInterstitialAd {
    static createForAdRequest(adUnitId: string) {
      return new MockInterstitialAd(adUnitId);
    }

    private adUnitId: string;
    private listeners: Map<string, Set<Function>> = new Map();

    constructor(adUnitId: string) {
      this.adUnitId = adUnitId;
    }

    addAdEventListener(type: string, handler: Function) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)!.add(handler);
      
      // Return unsubscribe function
      return () => {
        const handlers = this.listeners.get(type);
        if (handlers) {
          handlers.delete(handler);
        }
      };
    }

    load() {
      // Simulate error/failure event or just do nothing (no ads loaded)
      // Trigger error so loader knows we aren't showing ads.
      setTimeout(() => {
        const handlers = this.listeners.get(AdEventType.ERROR);
        if (handlers) {
          handlers.forEach((h) => h(new Error('Ads disabled in Expo Go')));
        }
      }, 100);
    }

    show() {
      console.log('[InterstitialAd Mock] show() called');
      return Promise.resolve();
    }
  }

  InterstitialAd = MockInterstitialAd;
}

export { MobileAds, InterstitialAd, AdEventType, TestIds };
export default MobileAds;
