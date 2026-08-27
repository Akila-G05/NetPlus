/**
 * Tools Tab — Network utilities, IP tracking, settings navigation, and upcoming diagnostic suites.
 * Developed by Solarfox.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import { useRouter } from 'expo-router';
import {
  getBackgroundLogsAsync,
  clearBackgroundLogsAsync,
  type BackgroundLogEntry,
} from '@/services/BackgroundTaskService';

interface IpDetails {
  ip: string;
  type?: string;
  org?: string;
  isp?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

export default function ToolsScreen() {
  const router = useRouter();

  // Background Pinging State
  const [bgLogsModalVisible, setBgLogsModalVisible] = useState(false);
  const [bgLogs, setBgLogs] = useState<BackgroundLogEntry[]>([]);

  // IP Tracking State
  const [ipModalVisible, setIpModalVisible] = useState(false);
  const [searchIp, setSearchIp] = useState('');
  const [ipLoading, setIpLoading] = useState(false);
  const [ipDetails, setIpDetails] = useState<IpDetails | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);

  const handleOpenBgLogs = async () => {
    const logs = await getBackgroundLogsAsync();
    setBgLogs(logs);
    setBgLogsModalVisible(true);
  };

  const handleClearBgLogs = async () => {
    await clearBackgroundLogsAsync();
    setBgLogs([]);
    Alert.alert('Logs Cleared', 'Background diagnostic logs have been reset.');
  };

  const fetchIpDetails = async (queryTarget?: string) => {
    setIpLoading(true);
    setIpError(null);
    try {
      const cleanTarget = queryTarget ? queryTarget.trim().replace(/^https?:\/\//i, '').split('/')[0] : '';
      const endpoint = cleanTarget ? `https://ipapi.co/${cleanTarget}/json/` : 'https://ipapi.co/json/';
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) {
        const fbEndpoint = cleanTarget ? `http://ip-api.com/json/${cleanTarget}` : 'http://ip-api.com/json/';
        const fbRes = await fetch(fbEndpoint);
        const fbData = await fbRes.json();
        if (fbData.status === 'fail') {
          throw new Error(fbData.message || 'Failed to lookup IP details');
        }
        setIpDetails({
          ip: fbData.query || cleanTarget || 'Unknown IP',
          isp: fbData.isp || fbData.org || 'Unknown ISP',
          org: fbData.org || fbData.as || 'Unknown AS',
          city: fbData.city || 'Unknown',
          region: fbData.regionName || fbData.region || 'Unknown',
          country: fbData.country || 'Unknown',
          countryCode: fbData.countryCode || '',
          lat: fbData.lat,
          lon: fbData.lon,
          timezone: fbData.timezone || 'UTC',
        });
      } else {
        const data = await res.json();
        if (data.error) {
          throw new Error(data.reason || 'Invalid IP or domain name');
        }
        setIpDetails({
          ip: data.ip || cleanTarget || 'Unknown IP',
          type: data.version || 'IPv4',
          isp: data.org || data.asn || 'Unknown ISP',
          org: data.org || data.asn || 'Unknown AS',
          city: data.city || 'Unknown',
          region: data.region || 'Unknown',
          country: data.country_name || 'Unknown',
          countryCode: data.country_code || '',
          lat: data.latitude,
          lon: data.longitude,
          timezone: data.timezone || 'UTC',
        });
      }
    } catch (err: any) {
      setIpError(err?.message || 'Unable to resolve IP geolocation information.');
    } finally {
      setIpLoading(false);
    }
  };

  const handleOpenIpTracking = () => {
    setIpModalVisible(true);
    if (!ipDetails) {
      fetchIpDetails();
    }
  };

  return (
    <ScrollView
      style={gs.screenContainer}
      contentContainerStyle={[gs.scrollContent, { paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={gs.headlineLg}>Tools</Text>
        <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 4 }]}>
          Network utilities, IP tracking, settings, and diagnostic suites.
        </Text>
      </View>

      {/* ── CARD 1: NETWORK UTILITIES ──────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="build" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>NETWORK UTILITIES</Text>
        </View>

        {/* IP Tracking & Geolocation */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleOpenIpTracking}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="my-location" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>IP Tracking & Geolocation</Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant, marginTop: 2 }]}>
                Track Public IP, ISP, ASN & Location
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Background Logs */}
        <TouchableOpacity
          style={[styles.actionRow, styles.rowBorder]}
          onPress={handleOpenBgLogs}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="history" size={20} color={Colors.tertiary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Background Diagnostic Logs</Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant, marginTop: 2 }]}>
                View periodic latency & disconnect events
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* ── CARD 2: SETTINGS ───────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="settings" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>SETTINGS</Text>
        </View>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="tune" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionText}>Settings & Preferences</Text>
              <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant, marginTop: 2 }]}>
                Data units, auto-save logs, privacy policy & reset
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* ── CARD 3: MORE TOOLS (COMING SOON) ────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="auto-awesome" size={20} color={Colors.warning} />
          <Text style={styles.cardTitle}>MORE TOOLS (COMING SOON)</Text>
        </View>

        <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginBottom: 14 }]}>
          Advanced network diagnostic tools currently under development by Solarfox:
        </Text>

        <View style={styles.upcomingGrid}>
          {/* Port Scanner */}
          <View style={styles.upcomingItem}>
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="radar" size={18} color={Colors.primary} />
                <Text style={styles.upcomingTitle}>Port Scanner</Text>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>SOON</Text>
              </View>
            </View>
            <Text style={styles.upcomingDesc}>
              Scan active TCP ports (80, 443, 22, 21, 8080) to detect open services and security exposures.
            </Text>
          </View>

          {/* DNS & WHOIS Lookup */}
          <View style={[styles.upcomingItem, styles.rowBorder]}>
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="dns" size={18} color={Colors.secondary} />
                <Text style={styles.upcomingTitle}>DNS & WHOIS Query</Text>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>SOON</Text>
              </View>
            </View>
            <Text style={styles.upcomingDesc}>
              Query A, AAAA, MX, NS & TXT records, authoritative name servers, and domain WHOIS info.
            </Text>
          </View>

          {/* Traceroute & Hops */}
          <View style={[styles.upcomingItem, styles.rowBorder]}>
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="alt-route" size={18} color={Colors.tertiary} />
                <Text style={styles.upcomingTitle}>Traceroute & Hop Analysis</Text>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>SOON</Text>
              </View>
            </View>
            <Text style={styles.upcomingDesc}>
              Trace hop-by-hop packet routing paths and pinpoint intermediate network latency spikes.
            </Text>
          </View>

          {/* SSL Cert Inspector */}
          <View style={[styles.upcomingItem, styles.rowBorder]}>
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="lock" size={18} color={Colors.warning} />
                <Text style={styles.upcomingTitle}>SSL Cert Inspector</Text>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>SOON</Text>
              </View>
            </View>
            <Text style={styles.upcomingDesc}>
              Inspect SSL/TLS expiration dates, Certificate Authority (CA) chains, and cipher algorithms.
            </Text>
          </View>

          {/* Wi-Fi Channel Analyzer */}
          <View style={[styles.upcomingItem, styles.rowBorder]}>
            <View style={styles.upcomingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="wifi-find" size={18} color={Colors.error} />
                <Text style={styles.upcomingTitle}>Wi-Fi Channel Analyzer</Text>
              </View>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>SOON</Text>
              </View>
            </View>
            <Text style={styles.upcomingDesc}>
              Evaluate Wi-Fi channel frequency congestion, RSSI signal strength, and access point metrics.
            </Text>
          </View>
        </View>
      </View>

      {/* ── IP TRACKING MODAL ────────────────────────────── */}
      <Modal
        visible={ipModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIpModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="my-location" size={22} color={Colors.primary} />
                <Text style={styles.modalTitle}>IP Tracking & Geolocation</Text>
              </View>
              <TouchableOpacity onPress={() => setIpModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.ipSearchBox}>
                <TextInput
                  style={styles.ipInput}
                  placeholder="IP address or domain (e.g. 8.8.8.8)..."
                  placeholderTextColor={Colors.outline}
                  value={searchIp}
                  onChangeText={setSearchIp}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.ipSearchBtn}
                  onPress={() => fetchIpDetails(searchIp)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="search" size={18} color="#ffffff" />
                  <Text style={styles.ipSearchBtnText}>Search</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.myIpBtn}
                onPress={() => {
                  setSearchIp('');
                  fetchIpDetails();
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="gps-fixed" size={14} color={Colors.primary} />
                <Text style={styles.myIpBtnText}>My Public IP</Text>
              </TouchableOpacity>

              {ipLoading ? (
                <View style={styles.ipLoadingBox}>
                  <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant }]}>Fetching IP geolocation data...</Text>
                </View>
              ) : ipError ? (
                <View style={styles.ipErrorBox}>
                  <MaterialIcons name="error-outline" size={24} color={Colors.error} />
                  <Text style={[gs.bodyMd, { color: Colors.error, marginTop: 4, textAlign: 'center' }]}>{ipError}</Text>
                </View>
              ) : ipDetails ? (
                <View style={styles.ipResultCard}>
                  <View style={styles.ipHeaderRow}>
                    <Text style={styles.ipBigText}>{ipDetails.ip}</Text>
                    {ipDetails.countryCode ? (
                      <View style={styles.countryBadge}>
                        <Text style={styles.countryBadgeText}>{ipDetails.countryCode}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.ipGrid}>
                    <View style={styles.ipGridItem}>
                      <Text style={gs.labelCaps}>ISP / CARRIER</Text>
                      <Text style={styles.ipValText}>{ipDetails.isp}</Text>
                    </View>

                    <View style={styles.ipGridItem}>
                      <Text style={gs.labelCaps}>LOCATION</Text>
                      <Text style={styles.ipValText}>
                        {[ipDetails.city, ipDetails.region, ipDetails.country].filter(Boolean).join(', ')}
                      </Text>
                    </View>

                    <View style={styles.ipGridItem}>
                      <Text style={gs.labelCaps}>ORGANIZATION / ASN</Text>
                      <Text style={styles.ipValText}>{ipDetails.org}</Text>
                    </View>

                    {ipDetails.lat && ipDetails.lon ? (
                      <View style={styles.ipGridItem}>
                        <Text style={gs.labelCaps}>COORDINATES</Text>
                        <Text style={styles.ipValText}>
                          {ipDetails.lat}, {ipDetails.lon}
                        </Text>
                      </View>
                    ) : null}

                    {ipDetails.timezone ? (
                      <View style={styles.ipGridItem}>
                        <Text style={gs.labelCaps}>TIMEZONE</Text>
                        <Text style={styles.ipValText}>{ipDetails.timezone}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity
              style={[gs.btnPrimary, { marginTop: 16 }]}
              onPress={() => setIpModalVisible(false)}
            >
              <Text style={gs.btnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── BACKGROUND LOGS MODAL ─────────────────────────── */}
      <Modal
        visible={bgLogsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBgLogsModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="history" size={22} color={Colors.tertiary} />
                <Text style={styles.modalTitle}>Background Diagnostics</Text>
              </View>
              <TouchableOpacity onPress={() => setBgLogsModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {bgLogs.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <MaterialIcons name="history-toggle-off" size={48} color={Colors.outline} />
                <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 12 }]}>
                  No background diagnostic logs recorded yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={bgLogs}
                keyExtractor={(item) => item.id}
                style={{ marginTop: 12, maxHeight: 380 }}
                renderItem={({ item }) => (
                  <View style={styles.bgLogItem}>
                    <View style={styles.bgLogHeader}>
                      <Text style={[gs.codeSm, { color: Colors.primary }]}>{item.timestamp}</Text>
                      <View style={[styles.statusTag, { backgroundColor: item.status === 'SUCCESS' ? 'rgba(120,220,119,0.15)' : 'rgba(255,59,48,0.15)' }]}>
                        <Text style={[styles.statusTagText, { color: item.status === 'SUCCESS' ? Colors.tertiary : Colors.error }]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={[gs.bodyMd, { color: Colors.onSurface, marginTop: 4 }]}>
                      Target: {item.host} ({item.networkType})
                    </Text>
                    <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant, marginTop: 2 }]}>
                      Latency: {item.latencyMs} ms
                    </Text>
                  </View>
                )}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1, backgroundColor: Colors.surfaceContainerHighest }]}
                onPress={handleClearBgLogs}
              >
                <Text style={[gs.btnPrimaryText, { color: Colors.onSurface }]}>Clear Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1 }]}
                onPress={() => setBgLogsModalVisible(false)}
              >
                <Text style={gs.btnPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.elementGap,
  },
  cardTitle: {
    ...Typography.labelCaps,
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '500',
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },

  // ── Upcoming Tools ─────────────────────────────────────
  upcomingGrid: {
    marginTop: 4,
  },
  upcomingItem: {
    paddingVertical: 12,
  },
  upcomingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  upcomingTitle: {
    ...Typography.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface,
  },
  upcomingDesc: {
    ...Typography.bodyMd,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.onSurfaceVariant,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 167, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  comingSoonText: {
    ...Typography.labelCaps,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.warning,
  },

  // ── IP Tracking UI ─────────────────────────────────────
  ipSearchBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ipInput: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: Colors.onSurface,
    ...Typography.bodyMd,
    fontSize: 13,
  },
  ipSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  ipSearchBtnText: {
    ...Typography.labelCaps,
    color: '#ffffff',
    fontSize: 11,
  },
  myIpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 16,
    backgroundColor: 'rgba(75, 142, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  myIpBtnText: {
    ...Typography.labelCaps,
    fontSize: 10,
    color: Colors.primary,
  },
  ipLoadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  ipErrorBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  ipResultCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 16,
    marginTop: 4,
  },
  ipHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 12,
    marginBottom: 12,
  },
  ipBigText: {
    ...Typography.headlineMd,
    color: Colors.primary,
    fontFamily: Typography.headlineLg.fontFamily,
    fontSize: 20,
  },
  countryBadge: {
    backgroundColor: 'rgba(120, 220, 119, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countryBadgeText: {
    ...Typography.labelCaps,
    color: Colors.tertiary,
    fontSize: 11,
    fontWeight: '700',
  },
  ipGrid: {
    gap: 12,
  },
  ipGridItem: {},
  ipValText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Background Logs Items ──────────────────────────────
  bgLogItem: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 10,
    marginBottom: 8,
  },
  bgLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagText: {
    ...Typography.labelCaps,
    fontSize: 9,
    fontWeight: '700',
  },

  fullModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  fullModalContent: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  modalTitle: {
    ...Typography.headlineMd,
    color: Colors.onSurface,
  },
  modalBodyScroll: {
    marginTop: 12,
  },
});
