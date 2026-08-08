/**
 * Settings Tab — Application settings and configuration.
 * Recreates UI/settings/code.html and UI/settings/screen.png.
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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { gs } from '@/styles/globalStyles';
import SettingsRow, { SettingsToggle } from '@/components/SettingsRow';

interface SimpleSelectProps {
  options: string[];
  selectedOption: string;
  onSelect: (option: string) => void;
}

function SimpleSelect({ options, selectedOption, onSelect }: SimpleSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.selectTrigger}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectTriggerText}>{selectedOption}</Text>
        <MaterialIcons name="arrow-drop-down" size={18} color={Colors.onSurfaceVariant} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    item === selectedOption && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      item === selectedOption && styles.modalOptionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {item === selectedOption && (
                    <MaterialIcons name="check" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function SettingsScreen() {
  // General State
  const [theme, setTheme] = useState('Dark Mode');
  const [language, setLanguage] = useState('English (US)');
  const [notifications, setNotifications] = useState(true);

  // Ping Config State
  const [pingInterval, setPingInterval] = useState('1000');
  const [pingTimeout, setPingTimeout] = useState('5000');
  const [continuousPing, setContinuousPing] = useState(true);

  // Speed Test State
  const [dataUnits, setDataUnits] = useState('Mbps');
  const [saveHistory, setSaveHistory] = useState(true);

  return (
    <ScrollView
      style={gs.screenContainer}
      contentContainerStyle={gs.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={gs.headlineLg}>Settings</Text>
        <Text style={[gs.bodyMd, { color: Colors.onSurfaceVariant, marginTop: 4 }]}>
          Configure diagnostic tools and application preferences.
        </Text>
      </View>

      {/* General Settings Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="tune" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>GENERAL</Text>
        </View>

        <SettingsRow label="Theme">
          <SimpleSelect
            options={['Dark Mode', 'Light Mode', 'System Default']}
            selectedOption={theme}
            onSelect={setTheme}
          />
        </SettingsRow>

        <SettingsRow label="Language" bordered>
          <SimpleSelect
            options={['English (US)', 'Spanish', 'French']}
            selectedOption={language}
            onSelect={setLanguage}
          />
        </SettingsRow>

        <SettingsToggle
          label="Notifications"
          value={notifications}
          onValueChange={setNotifications}
          bordered
        />
      </View>

      {/* Ping Config Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="wifi-tethering" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>PING CONFIG</Text>
        </View>

        <SettingsRow label="Interval (ms)">
          <TextInput
            style={styles.numberInput}
            value={pingInterval}
            onChangeText={setPingInterval}
            keyboardType="numeric"
          />
        </SettingsRow>

        <SettingsRow label="Timeout (ms)" bordered>
          <TextInput
            style={styles.numberInput}
            value={pingTimeout}
            onChangeText={setPingTimeout}
            keyboardType="numeric"
          />
        </SettingsRow>

        <SettingsToggle
          label="Continuous Ping"
          value={continuousPing}
          onValueChange={setContinuousPing}
          bordered
        />
      </View>

      {/* Speed Test Settings Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="speed" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>SPEED TEST</Text>
        </View>

        <SettingsRow label="Data Units">
          <SimpleSelect
            options={['Mbps', 'MB/s', 'Kbps']}
            selectedOption={dataUnits}
            onSelect={setDataUnits}
          />
        </SettingsRow>

        <SettingsToggle
          label="Save History"
          value={saveHistory}
          onValueChange={setSaveHistory}
          bordered
        />
      </View>

      {/* Pro Account Card */}
      <View style={[styles.card, styles.proCard]}>
        <View style={styles.proHeader}>
          <MaterialIcons name="workspace-premium" size={22} color={Colors.secondaryContainer} />
          <Text style={styles.proTitle}>PRO ACCOUNT</Text>
        </View>
        <Text style={[gs.bodyMd, { color: Colors.onSurface, marginVertical: 12 }]}>
          Unlock advanced diagnostics, unlimited history, and premium server access.
        </Text>
        <TouchableOpacity style={gs.btnPrimary} activeOpacity={0.8}>
          <Text style={gs.btnPrimaryText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: Spacing.containerPadding,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    paddingBottom: 8,
    marginBottom: 4,
  },
  cardTitle: {
    ...Typography.labelCaps,
    color: Colors.onSurface,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  selectTriggerText: {
    ...Typography.codeSm,
    color: Colors.onSurface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 8,
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOptionSelected: {
    backgroundColor: Colors.surfaceBright,
  },
  modalOptionText: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
  modalOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  numberInput: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 80,
    textAlign: 'right',
    color: Colors.onSurface,
    ...Typography.codeSm,
  },
  proCard: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderColor: Colors.outlineVariant,
  },
  proHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proTitle: {
    ...Typography.labelCaps,
    color: Colors.secondaryContainer,
  },
});
