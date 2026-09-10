# ZPinger vs NetPulse — Ping Method Comparison

**Analysis date:** 2026-09-10
**ZPinger:** `com.zentix.zpinger` **v2.2.8** (versionCode 18, not debuggable) — `base.apk` + `split_config.x86_64.apk` pulled from the emulator; native code extracted from `lib/x86_64/libapp.so` (Dart AOT) and searched for symbols/strings.
**NetPulse:** current workspace state — `modules/NetPlusPing/android/...` (native) and `src/app/(tabs)/pinging.tsx` (JS/UI).

> Evidence note: facts marked **[byte-level]** are directly visible in the extracted binary
> (string/symbol table). Facts marked **[inferred]** are reasonable conclusions from
> that evidence plus observed behavior; exact values (e.g. timeout milliseconds) are
> AOT-encoded and not recoverable from UTF-8 strings.

## 1. Protocol family

| | ZPinger | NetPulse |
|---|---|---|
| Ping engine | **HTTP(S) only** — no ICMP anywhere in the binary [byte-level: no ICMP echo/raw-socket constants or symbols; socket symbols are all Dart HTTP: `_RawSocket`, `_SecureSocket`, `_HttpParser`, `_HttpClientResponse`] | **Two selectable methods**: **ICMP** (default, UI "ICMP (Recommended)") and **HTTP** |
| ICMP implementation | N/A | Unprivileged ICMP echo via Java `DatagramSocket` (`IcmpPing.kt`): type 8 request / type 10 reply, RFC 1071 checksum, 16-bit ID + seq, 64-byte nanosecond-timestamp payload. No root / `CAP_NET_RAW` needed — on most Android 7+ the kernel answers echo replies for unprivileged datagrams. If the carrier blocks ICMP, a probe **silently falls back to HTTP** |
| HTTP implementation | **Dio on `dart:io`** [byte-level: `RequestOptions.connectTimeout/receiveTimeout/sendTimeout`, `DioException.connectionTimeout/receiveTimeout/sendTimeout`, `_ClientSocketException`, `Cookie`, `HttpException`]. TLS = **BoringSSL** | Java `HttpURLConnection` (`NetPlusPingForegroundService.kt`). TLS = **Conscrypt**. Custom UA `Dart/3.3 (dart:io)`, `Accept-Encoding: gzip`, auto-follows redirects. Fixed 60 s connect + 60 s read budget per attempt |

**Key difference for Hutch:** ZPinger speaks via dart:io / BoringSSL; NetPulse speaks via Java / Conscrypt while spoofing the same Dart UA. WAFs (Hutch's `oneapp.hutch.lk` sits behind one) fingerprint the TLS handshake (JA3) as well as headers, so the same host can answer 200 to one stack and 403/reset to the other. Earlier UA probes observed: `Dart/3.3 (dart:io)` → 200; bare/Dalvik UAs → 403 on `oneapp.hutch.lk`.

## 2. Success / failure criteria

| | ZPinger | NetPulse (current) |
|---|---|---|
| Success | Reads `response.statusCode` [byte-level: `get:statusCode`]. 2xx → success; otherwise **"bad response"** = failed [inferred: "bad response" string is the failure label] | **200 / 301 / 302 / 403** = reachable (`isReachableHttpStatus`) and counted as a live ping; reported latency is floor-clamped to ≥ 5 ms (`MIN_HTTP_LATENCY_MS`) |
| 403 handling | **Counted as failure** ("bad response") | **Counted as SUCCESS / reachable** (e.g. WAF-gated `oneapp.hutch.lk`) |
| Timeout | `DioException.connectionTimeout` / `receiveTimeout` / `sendTimeout` → failed | HTTP: read/connect timeout → failed. ICMP: per-probe socket `soTimeout` capped at `min(interval×2, 5000)` ms |
| Network-level failure | `_ClientSocketException`, "Connection Lost", "Connection failed", "Failed host lookup", "Connection closed before response was received" → failed | Caught exception (timeout / TLS / reset) → failed, one automatic retry per probe for these (transport-level) failures only |
| HTTP status 404/500 | "bad response" → failed | Failed, and **not** retried (a status code won't change on retry) |
| Sub-5 ms responses | Counted (dio has no floor concept) | Reported as 5 ms floor (cache-local replies aren't a real RTT) but still count as **success** — success is decoupled from the floor |
| Failure visibility | User-facing labels only [byte-level: "Connection Lost", "bad response", "Failed host lookup"] | Failure `reason` (HTTP code or exception class like `SSLHandshakeException`, `SocketTimeoutException`) shown in the notification and via `Log.w("NetPlusPing", ...)` for logcat |

## 3. Timeouts & cadence

| | ZPinger | NetPulse |
|---|---|---|
| Timeout config | Explicit Dio `connectTimeout` / `receiveTimeout` / `sendTimeout` [byte-level]; exact ms AOT-encoded, not readable [inferred] | HTTP: 60 s connect + 60 s read (`MAX_HTTP_TIMEOUT_MS`). ICMP: per-probe `soTimeout` of `min(interval×2, 5000)`; ICMP probes are additionally wrapped in `withTimeoutOrNull(max(timeoutMs+2000, 5000))` |
| Cadence | Periodic timer [byte-level: `_restartTimer`] at the user interval | Foreground service loop at `intervalMs`; optional **Relax/"Battery Saver" mode** (20 s cadence via inexact `setAndAllowWhileIdle` alarms) |
| Attempts per probe | 1 [inferred] | 1, plus 1 retry for transport-level HTTP failures (worst-case probe 2×60 s) |
| Background survival | Background service + Quick Settings tile [byte-level: "Z Pinger" tile help text] | Foreground service + boot receiver watchdog (`ACTION_WATCHDOG_*`) + WakeLock + persistent low-importance notification |

## 4. Targets & custom URLs

| | ZPinger | NetPulse |
|---|---|---|
| Presets (identical) | Google, Hutch `https://oneapp.hutch.lk`, Dialog, Mobitel, Airtel | Google, Hutch `https://oneapp.hutch.lk`, Dialog, Mobitel, Airtel |
| URL probed | Homepage root of each preset | Homepage root, except Google/Cloudflare IP targets → `https://www.google.com/generate_204` / `https://1.1.1.1/cdn-cgi/trace` |
| Custom slots | 4 custom URLs [byte-level: `custom_url`, `custom_url_1`, `custom_url_2`, `custom_url_3`; UI "Custom URL", "Custom URL 1-3"] | Single `customHost` today; multi-slot `Custom 1-3` is planned (Feature 5) |

## 5. Notable binary evidence (ZPinger 2.2.8)

- Uses **Dio** HTTP client on the Dart VM: `RequestOptions.connectTimeout/receiveTimeout/sendTimeout`, `DioException.connectionTimeout/receiveTimeout/sendTimeout`, `HttpException`, `Cookie`.
- Success reads `statusCode`; failure strings: `bad response`, `Connection Lost`, `Connection failed`, `Failed host lookup`, `Connection closed before response was received`.
- `SPECIAL FIX FOR HUTCH` and `target_network_name` exist (predates 2.2.8) — Hutch already gets host-specific handling in ZPinger.
- Custom URL persistence keys: `custom_url`, `custom_url_1..3`.
- Background UX: "Z Pinger" Quick Settings tile, "toggle Z Pinger directly from your status bar".

## 6. Takeaways for the Hutch (`oneapp.hutch.lk`) case

1. **ZPinger is not more lenient than NetPulse needs to be** — it also counts a 403 as a failed "bad response". NetPulse's current rule (200/301/302/403 = reachable) already goes further.
2. `oneapp.hutch.lk` intermittently returns 403 (user-observed) and can also refuse at the transport layer. NetPulse now: counts reachable-403 as a live ping, retries transport failures once, and reports the exact failure reason in the notification/logcat so further tuning (e.g. a BoringSSL-based client for true TLS-fingerprint parity) is data-driven.
3. An ICMP-method session also benefits: when the carrier blocks ICMP, the probe falls back to HTTP, inheriting all of the above.