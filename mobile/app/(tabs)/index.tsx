/**
 * Review Queue — Main screen showing pending DM reply suggestions.
 * Pull-to-refresh, real-time badge count, approve/edit/skip actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { palette } from '@/constants/Colors';
import { Queue, QueueItem } from '@/types/queue';
import { fetchQueue, approveReply, skipReply, getCredentials } from '@/services/gistService';
import ReplyCard from '@/components/ReplyCard';
import StatusDot from '@/components/StatusDot';

export default function ReviewQueueScreen() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    setError(null);

    try {
      const creds = await getCredentials();
      if (!creds) {
        setIsConfigured(false);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      setIsConfigured(true);

      const data = await fetchQueue();
      if (data) {
        setQueue(data);
      } else {
        setError('Failed to fetch queue. Check your connection.');
      }
    } catch (e) {
      setError('Something went wrong. Pull to refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadQueue();
  }, []);

  // Reload when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadQueue();
    }, [])
  );

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isConfigured) return;
    const interval = setInterval(() => loadQueue(), 30000);
    return () => clearInterval(interval);
  }, [isConfigured]);

  const handleApprove = async (id: string, reply: string) => {
    setProcessingId(id);
    const success = await approveReply(id, reply);
    if (success) {
      // Optimistic update
      setQueue((prev) => {
        if (!prev) return prev;
        const item = prev.pending.find((i) => i.id === id);
        if (!item) return prev;
        return {
          ...prev,
          pending: prev.pending.filter((i) => i.id !== id),
          approved: [...prev.approved, { ...item, status: 'approved' as const, final_reply: reply }],
        };
      });
    }
    setProcessingId(null);
  };

  const handleSkip = async (id: string) => {
    setProcessingId(id);
    const success = await skipReply(id);
    if (success) {
      // Optimistic update
      setQueue((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: prev.pending.filter((i) => i.id !== id),
          skipped: [...prev.skipped, ...prev.pending.filter((i) => i.id === id).map((i) => ({ ...i, status: 'skipped' as const }))],
        };
      });
    }
    setProcessingId(null);
  };

  // Not configured state
  if (isConfigured === false) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⚙️</Text>
          <Text style={styles.emptyTitle}>Setup Required</Text>
          <Text style={styles.emptySubtitle}>
            Go to Settings to configure your{'\n'}Gist ID and GitHub PAT
          </Text>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={palette.brand.primary} />
          <Text style={[styles.emptySubtitle, { marginTop: 16 }]}>
            Loading queue...
          </Text>
        </View>
      </View>
    );
  }

  const pendingItems = queue?.pending || [];
  const approvedCount = queue?.approved?.length || 0;

  return (
    <View style={styles.container}>
      {/* Header stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <StatusDot color={palette.brand.warning} size={6} pulse={pendingItems.length > 0} />
          <Text style={styles.statValue}>{pendingItems.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <StatusDot color={palette.brand.accent} size={6} pulse={false} />
          <Text style={styles.statValue}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Queued</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <StatusDot color={palette.brand.secondary} size={6} pulse={false} />
          <Text style={styles.statValue}>{queue?.sent?.length || 0}</Text>
          <Text style={styles.statLabel}>Sent</Text>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Queue list */}
      <FlatList
        data={pendingItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReplyCard
            item={item}
            onApprove={handleApprove}
            onSkip={handleSkip}
            isProcessing={processingId === item.id}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadQueue(true)}
            tintColor={palette.brand.primary}
            colors={[palette.brand.primary]}
          />
        }
        contentContainerStyle={pendingItems.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No pending reply suggestions.{'\n'}Pull down to refresh.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.dark.background,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: palette.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.dark.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: palette.text.tertiary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.dark.border,
  },
  errorBanner: {
    backgroundColor: palette.brand.danger + '15',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.brand.danger + '30',
  },
  errorText: {
    color: palette.brand.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
