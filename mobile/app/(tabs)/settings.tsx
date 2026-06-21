/**
 * Settings Screen — Configure Gist credentials and app preferences.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { palette } from '@/constants/Colors';
import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  testConnection,
  fetchState,
  timeAgo,
} from '@/services/gistService';
import StatusDot from '@/components/StatusDot';
import { AppState } from '@/types/queue';

export default function SettingsScreen() {
  const [gistId, setGistId] = useState('');
  const [ghPat, setGhPat] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [appState, setAppState] = useState<AppState | null>(null);

  useEffect(() => {
    loadCredentials();
    loadState();
  }, []);

  const loadCredentials = async () => {
    const creds = await getCredentials();
    if (creds) {
      setGistId(creds.gistId);
      setGhPat(creds.ghPat);
      setIsConnected(true);
    }
  };

  const loadState = async () => {
    const state = await fetchState();
    if (state) {
      setAppState(state);
    }
  };

  const handleSave = async () => {
    if (!gistId.trim() || !ghPat.trim()) {
      Alert.alert('Missing Fields', 'Please enter both Gist ID and GitHub PAT.');
      return;
    }

    setIsSaving(true);
    await saveCredentials(gistId.trim(), ghPat.trim());
    setIsSaving(false);

    // Auto-test connection
    handleTestConnection();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await testConnection();
    setIsConnected(result.success);
    setConnectionMessage(result.message);
    setIsTesting(false);

    if (result.success) {
      loadState();
    }
  };

  const handleClearCredentials = () => {
    Alert.alert(
      'Clear Credentials',
      'Are you sure you want to remove your saved credentials?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearCredentials();
            setGistId('');
            setGhPat('');
            setIsConnected(null);
            setConnectionMessage('');
            setAppState(null);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Connection Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <StatusDot
            color={isConnected ? palette.brand.accent : palette.brand.danger}
            size={10}
            pulse={isConnected === true}
          />
          <Text style={styles.statusTitle}>
            {isConnected === null ? 'Not Configured' : isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        {connectionMessage ? (
          <Text
            style={[
              styles.statusMessage,
              { color: isConnected ? palette.brand.accent : palette.brand.danger },
            ]}
          >
            {connectionMessage}
          </Text>
        ) : null}

        {appState && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{appState.run_count || 0}</Text>
              <Text style={styles.statLabel}>Total Runs</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{timeAgo(appState.last_run)}</Text>
              <Text style={styles.statLabel}>Last Run</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {Object.keys(appState.last_checked || {}).length}
              </Text>
              <Text style={styles.statLabel}>Channels</Text>
            </View>
          </View>
        )}
      </View>

      {/* Credentials Section */}
      <Text style={styles.sectionTitle}>🔑 Credentials</Text>
      <Text style={styles.sectionSubtitle}>
        Stored securely on-device via SecureStore
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Gist ID</Text>
        <TextInput
          style={styles.input}
          value={gistId}
          onChangeText={setGistId}
          placeholder="3ccbf73ad0fbb8ada3900989ef7ac570"
          placeholderTextColor={palette.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.inputHint}>
          From your Gist URL: gist.github.com/you/[THIS_ID]
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>GitHub PAT</Text>
        <TextInput
          style={styles.input}
          value={ghPat}
          onChangeText={setGhPat}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          placeholderTextColor={palette.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.inputHint}>
          Personal Access Token with 'gist' scope
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.saveButton,
            pressed && styles.buttonPressed,
            isSaving && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={palette.text.primary} />
          ) : (
            <Text style={styles.saveButtonText}>💾 Save & Connect</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.testButton,
            pressed && styles.buttonPressed,
            isTesting && styles.buttonDisabled,
          ]}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color={palette.brand.primaryLight} />
          ) : (
            <Text style={styles.testButtonText}>🔄 Test</Text>
          )}
        </Pressable>
      </View>

      {/* Danger zone */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.clearButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleClearCredentials}
        >
          <Text style={styles.clearButtonText}>🗑️ Clear Credentials</Text>
        </Pressable>
      </View>

      {/* About section */}
      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>Discord DM Responder</Text>
        <Text style={styles.aboutText}>
          AI-powered DM reply suggestions.{'\n'}
          Backend runs on GitHub Actions.{'\n'}
          State synced via GitHub Gist.
        </Text>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.dark.background,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  statusCard: {
    backgroundColor: palette.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: palette.dark.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text.primary,
  },
  statusMessage: {
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: palette.dark.surfaceLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: palette.text.tertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: palette.text.tertiary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text.secondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: palette.dark.surfaceLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: palette.text.primary,
    borderWidth: 1,
    borderColor: palette.dark.border,
  },
  inputHint: {
    fontSize: 11,
    color: palette.text.tertiary,
    marginTop: 6,
    marginLeft: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 2,
    backgroundColor: palette.brand.primary,
  },
  testButton: {
    flex: 1,
    backgroundColor: palette.dark.surfaceLight,
    borderWidth: 1,
    borderColor: palette.brand.primary + '40',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text.primary,
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.brand.primaryLight,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: palette.dark.border,
    paddingTop: 20,
    marginBottom: 32,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.brand.danger,
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: palette.brand.danger + '15',
    borderWidth: 1,
    borderColor: palette.brand.danger + '30',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.brand.danger,
  },
  aboutSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text.secondary,
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 12,
    color: palette.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  versionText: {
    fontSize: 11,
    color: palette.text.tertiary,
    marginTop: 8,
  },
});
