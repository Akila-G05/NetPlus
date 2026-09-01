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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import { useRouter } from 'expo-router';

export interface IpHistoryEntry {
  id: string;
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
  timestamp: string;
}

const IP_HISTORY_STORAGE_KEY = '@netplus/ip_history';

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

  // IP Tracking State
  const [ipModalVisible, setIpModalVisible] = useState(false);
  const [searchIp, setSearchIp] = useState('');
  const [ipLoading, setIpLoading] = useState(false);
  const [ipDetails, setIpDetails] = useState<IpDetails | null>(null);
  const [ipError, setIpError] = useState<string | null>(null);

  // IP History State
  const [ipHistoryModalVisible, setIpHistoryModalVisible] = useState(false);
  const [ipHistory, setIpHistory] = useState<IpHistoryEntry[]>([]);

  const loadIpHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(IP_HISTORY_STORAGE_KEY);
      if (raw) {
        setIpHistory(JSON.parse(raw));
      }
    } catch {}
  };

  React.useEffect(() => {
    loadIpHistory();
  }, []);

  const saveIpToHistory = async (details: IpDetails) => {
    if (!details.ip || details.ip === 'Unknown IP') return;
    try {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
      const newEntry: IpHistoryEntry = {
        id: Date.now().toString(),
        ...details,
        timestamp: nowStr,
      };

      setIpHistory((prev) => {
        const filtered = prev.filter((item) => item.ip !== details.ip);
        const updated = [newEntry, ...filtered].slice(0, 30);
        AsyncStorage.setItem(IP_HISTORY_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch {}
  };

  const handleClearIpHistory = async () => {
    try {
      await AsyncStorage.removeItem(IP_HISTORY_STORAGE_KEY);
      setIpHistory([]);
      Alert.alert('History Cleared', 'Tracked IP history has been reset.');
    } catch {}
  };

  const handleOpenIpHistory = async () => {
    await loadIpHistory();
    setIpHistoryModalVisible(true);
  };

  const handleSelectHistoryItem = (item: IpHistoryEntry) => {
    setIpDetails({
      ip: item.ip,
      type: item.type,
      isp: item.isp,
      org: item.org,
      city: item.city,
      region: item.region,
      country: item.country,
      countryCode: item.countryCode,
      lat: item.lat,
      lon: item.lon,
      timezone: item.timezone,
    });
    setSearchIp(item.ip);
    setIpHistoryModalVisible(false);
  };

  const fetchIpDetails = async (queryTarget?: string) => {
    setIpLoading(true);
    setIpError(null);
    try {
      const cleanTarget = queryTarget ? queryTarget.trim().replace(/^https?:\/\//i, '').split('/')[0] : '';
      const endpoint = cleanTarget ? `https://ipapi.co/${cleanTarget}/json/` : 'https://ipapi.co/json/';
      const res = await fetch(endpoint, { cache: 'no-store' });
      let fetchedDetails: IpDetails | null = null;
      if (!res.ok) {
        const fbEndpoint = cleanTarget ? `http://ip-api.com/json/${cleanTarget}` : 'http://ip-api.com/json/';
        const fbRes = await fetch(fbEndpoint);
        const fbData = await fbRes.json();
        if (fbData.status === 'fail') {
          throw new Error(fbData.message || 'Failed to lookup IP details');
        }
        fetchedDetails = {
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
        };
      } else {
        const data = await res.json();
        if (data.error) {
          throw new Error(data.reason || 'Invalid IP or domain name');
        }
        fetchedDetails = {
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
        };
      }
      setIpDetails(fetchedDetails);
      if (fetchedDetails) {
        saveIpToHistory(fetchedDetails);
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
                  placeholder="IP or domain (e.g. 8.8.8.8)..."
                  placeholderTextColor={Colors.outline}
                  value={searchIp}
                  onChangeText={setSearchIp}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[gs.btnPrimary, { paddingHorizontal: 14, paddingVertical: 8 }]}
                  onPress={() => fetchIpDetails(searchIp)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="search" size={18} color={Colors.onPrimary} />
                  <Text style={gs.btnPrimaryText}>Search</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.ipBadgeRow}>
                <TouchableOpacity
                  style={styles.myIpBtn}
                  onPress={() => {
                    setSearchIp('');
                    fetchIpDetails();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="gps-fixed" size={14} color={Colors.primary} />
                  <Text style={styles.myIpBtnText}>MY PUBLIC IP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.historyBadgeBtn}
                  onPress={handleOpenIpHistory}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="history" size={14} color={Colors.secondaryContainer} />
                  <Text style={styles.historyBadgeBtnText}>HISTORY</Text>
                </TouchableOpacity>
              </View>

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
                    {ipDetails.isp ? (
                      <View style={styles.ipGridItem}>
                        <Text style={gs.labelCaps}>ISP / CARRIER</Text>
                        <Text style={styles.ipValText}>{ipDetails.isp}</Text>
                      </View>
                    ) : null}

                    {ipDetails.org ? (
                      <View style={styles.ipGridItem}>
                        <Text style={gs.labelCaps}>ORGANIZATION / ASN</Text>
                        <Text style={styles.ipValText}>{ipDetails.org}</Text>
                      </View>
                    ) : null}

                    {ipDetails.city || ipDetails.region || ipDetails.country ? (
                      <View style={styles.ipGridItem}>
                        <Text style={gs.labelCaps}>LOCATION</Text>
                        <Text style={styles.ipValText}>
                          {[ipDetails.city, ipDetails.region, ipDetails.country].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    ) : null}

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

      {/* ── TRACKED IP HISTORY MODAL ───────────────────────── */}
      <Modal
        visible={ipHistoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIpHistoryModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.fullModalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="history" size={22} color={Colors.secondaryContainer} />
                <Text style={styles.modalTitle}>Tracked IP History</Text>
              </View>
              <TouchableOpacity onPress={() => setIpHistoryModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {ipHistory.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <MaterialIcons name="history-toggle-off" size={48} color={Colors.outline} />
                <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 12 }]}>
                  No IP search history recorded yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={ipHistory}
                keyExtractor={(item) => item.id}
                style={{ marginTop: 12, maxHeight: 380 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.historyItemCard}
                    onPress={() => handleSelectHistoryItem(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyItemHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.historyIpText}>{item.ip}</Text>
                        {item.countryCode ? (
                          <View style={styles.countryBadge}>
                            <Text style={styles.countryBadgeText}>{item.countryCode}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant }]}>{item.timestamp}</Text>
                    </View>

                    {item.isp || item.org ? (
                      <Text style={[gs.bodyMd, { color: Colors.onSurface, fontSize: 13, marginTop: 4 }]} numberOfLines={1}>
                        {item.isp || item.org}
                      </Text>
                    ) : null}

                    {[item.city, item.region, item.country].filter(Boolean).length > 0 ? (
                      <Text style={[gs.codeSm, { color: Colors.onSurfaceVariant, marginTop: 2 }]} numberOfLines={1}>
                        📍 {[item.city, item.region, item.country].filter(Boolean).join(', ')}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[gs.btnSecondary, { flex: 1 }]}
                onPress={handleClearIpHistory}
                disabled={ipHistory.length === 0}
              >
                <Text style={gs.btnSecondaryText}>Clear History</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[gs.btnPrimary, { flex: 1 }]}
                onPress={() => setIpHistoryModalVisible(false)}
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
  ipBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  myIpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(75, 142, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  myIpBtnText: {
    ...Typography.labelCaps,
    fontSize: 10,
    color: Colors.primary,
  },
  historyBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 227, 253, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  historyBadgeBtnText: {
    ...Typography.labelCaps,
    fontSize: 10,
    color: Colors.secondaryContainer,
  },
  historyItemCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 12,
    marginBottom: 8,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyIpText: {
    ...Typography.bodyMd,
    fontWeight: '700',
    color: Colors.primary,
    fontSize: 15,
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
