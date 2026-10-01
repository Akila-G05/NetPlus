# NetPlus (NetPulse)

An Android network utility app built with **Expo** and **React Native**. It measures
latency, throughput, and connection quality, and keeps monitoring in the background
through a custom native module.

The app ships as `NetPlus` (package `com.anonymous.NetPlus`); the repository is
`NetPulse`.

## Features

| Area | What it does |
|---|---|
| **Speed test** | Ping, download, and upload phases with live progress, run as a native foreground service so it survives leaving the app |
| **Continuous ping** | Repeated ICMP/HTTP pings against a chosen host with min/max/avg stats and a persistent notification |
| **Network monitor** | Live connection state and generation (2G/3G/4G/5G/no signal) via `@react-native-community/netinfo` |
| **Data usage** | Per-interface data consumption tracking (`DataUsageTracker`) |
| **Tools** | Network utilities, IP tracking, and navigation to settings and upcoming diagnostic suites |
| **Background operation** | Boot receiver restarts the ping service, and a battery-optimization exemption flow keeps the service alive |
| **Design** | Dark-first Material You palette in `UI/DESIGN.md`, Inter + JetBrains Mono typography, haptics, reanimated transitions |

## Tech stack

- **Expo SDK 54** / React Native 0.81.5, new architecture enabled, React 19.1
- **Expo Router** for file-based routing (`src/app/`)
- **TypeScript 5.9**
- **expo-notifications** for the foreground-service notifications
- **react-native-google-mobile-ads** for ads
- **Custom local native module** `netplus-ping` (`modules/NetPlusPing`, Kotlin)
  providing `ping`, continuous monitoring, background speed tests, and battery
  optimization helpers
- **react-native-svg** + **reanimated** for the gauge visualizations

## The native module

`modules/NetPlusPing` is a local Expo module written in Kotlin. It is the reason
several features only work in a real build rather than in Expo Go:

| Native class | Role |
|---|---|
| `NetPlusPingModule.kt` | Module API — ping, continuous ping, speed test, battery-optimization checks |
| `NetPlusPingForegroundService.kt` | Keeps continuous pinging alive in the background with a notification |
| `NetPlusSpeedTestForegroundService.kt` | Same, for long-running speed tests |
| `NetPlusPingBootReceiver.kt` | Restarts monitoring after device reboot |

Because it is native code, the app must be compiled:

```bash
npx expo run:android
```

In Expo Go, `isNetPlusPingAvailable()` returns false and the affected screens fall
back to JS-only behaviour.

## Project structure

```
app.json                     # Expo config (name, package, plugins, ad unit ids)
eas.json                     # EAS build profiles
src/
  app/                       # Expo Router routes
    (tabs)/                  # index, network, pinging, speedtest, tools, injector, settings
    settings.tsx
  components/                # CircularProgress, DataCard, StatBox, ConnectionStatusBar, ...
  constants/                 # theme tokens, network generation labels
  services/                  # DataUsageTracker, NotificationService, MobileAdsService
  styles/globalStyles.ts     # shared style helpers
  types/                     # TypeScript types
modules/NetPlusPing/         # Local Kotlin Expo module (native ICMP ping)
UI/                          # HTML design mockups and DESIGN.md (Material You tokens)
```

## Getting started

### Prerequisites

- Node.js 18+
- Android device or emulator (the native module is Android-only)
- Android Studio with a working SDK, for native builds
- Expo Go, only if you just want to explore the JS screens

### Install and run

```bash
git clone https://github.com/Akila-G05/NetPulse.git
cd NetPulse
npm install
```

Then pick a target:

```bash
npx expo start              # dev server; scan the QR code with Expo Go
npx expo run:android         # full native build, required for ping + background services
npx expo start --web        # static web build
```

Other scripts:

```bash
npm run lint                # eslint (eslint-config-expo)
npm run android             # alias for expo run:android
```

The `injector` tab is currently a `ComingSoon` placeholder for future packet
injection and header-manipulation tooling.

> `npm run reset-project` is defined in `package.json` but the referenced
> `scripts/reset-project.js` is not in the repo, so that script will fail.

## Battery optimization

Continuous monitoring and background speed tests depend on a foreground service
that Android may still throttle. The Settings screen can check whether the app is
exempt and deep-link to the system battery-optimization settings:

```ts
import { isIgnoringBatteryOptimizations } from 'netplus-ping';
```

## Notes

- `package.json` marks the package `private: true`, so `npx expo start` is the
  intended entry point; EAS profiles live in `eas.json`.
- The Android AdMob app id in `app.json` is a real unit; the iOS id is Google's
  public test id.
- `UI/` contains the HTML prototypes and the Material You color/typography tokens
  the React Native theme in `src/constants/theme.ts` is built from.

## License

MIT — see [LICENSE](LICENSE).
