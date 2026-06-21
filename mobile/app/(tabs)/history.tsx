/**
 * History Screen — Shows sent and skipped reply history.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { palette } from '@/constants/Colors';
import { Queue, QueueItem } from '@/types/queue';
import { fetchQueue, getCredentials, timeAgo } from '@/services/gistService';

type FilterType = 'all' | 'sent' | 'skipped' | 'approved';

export default function HistoryScreen() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadHistory = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);

    try {
      const creds = await getCredentials();
      if (!creds) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const data = await fetchQueue();
      if (data) {
        setQueue(data);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const getFilteredItems = (): QueueItem[] => {
    if (!queue) return [];

    let items: QueueItem[] = [];

    if (filter === 'all' || filter === 'sent') {
      items = [...items, ...(queue.sent || [])];
    }
    if (filter === 'all' || filter === 'skipped') {
      items = [...items, ...(queue.skipped || [])];
    }
    if (filter === 'all' || filter === 'approved') {
      items = [...items, ...(queue.approved || [])];
    }

    // Sort by most recent
    return items.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  };

  const filteredItems = getFilteredItems();

  const statusConfig = {
    sent: { color: palette.brand.secondary, icon: '📤', label: 'Sent' },
    approved: { color: palette.brand.accent, icon: '✅', label: 'Queued' },
    skipped: { color: palette.text.tertiary, icon: '⏭️', label: 'Skipped' },
    expired: { color: palette.brand.danger, icon: '⏰', label: 'Expired' },
    pending: { color: palette.brand.warning, icon: '⏳', label: 'Pending' },
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.brand.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterBar}>
        {(['all', 'sent', 'approved', 'skipped'] as FilterType[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}
            >
              {f === 'all' ? 'All' : f === 'approved' ? 'Queued' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        renderItem={({ item }) => {
          const cfg = statusConfig[item.status] || statusConfig.pending;
          return (
            <View style={styles.historyCard}>
              <View style={[styles.statusLine, { backgroundColor: cfg.color }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Image
                    source={{ uri: item.sender_avatar }}
                    style={styles.avatar}
                    defaultSource={require('@/assets/images/icon.png')}
                  />
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.senderName}>{item.sender_name}</Text>
                    <Text style={styles.timeText}>{timeAgo(item.updated_at || item.created_at)}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: cfg.color + '20' }]}>
                    <Text style={{ fontSize: 10 }}>{cfg.icon}</Text>
                    <Text style={[styles.statusPillText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.messageRow}>
                  <Text style={styles.messageLabel}>Them:</Text>
                  <Text style={styles.messagePreview} numberOfLines={2}>
                    {item.original_message}
                  </Text>
                </View>

                <View style={styles.messageRow}>
                  <Text style={styles.replyLabel}>Reply:</Text>
                  <Text style={styles.replyPreview} numberOfLines={2}>
                    {item.final_reply || item.suggested_reply}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadHistory(true)}
            tintColor={palette.brand.primary}
          />
        }
        contentContainerStyle={filteredItems.length === 0 ? styles.emptyList : styles.listContent}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySubtitle}>
              Replied and skipped messages will appear here.
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: palette.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.dark.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: palette.dark.surfaceLight,
  },
  filterTabActive: {
    backgroundColor: palette.brand.primary + '25',
    borderWidth: 1,
    borderColor: palette.brand.primary + '40',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text.tertiary,
  },
  filterTabTextActive: {
    color: palette.brand.primaryLight,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 100,
  },
  emptyList: {
    flex: 1,
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: palette.dark.surface,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.dark.border,
  },
  statusLine: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.dark.surfaceLight,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text.primary,
  },
  timeText: {
    fontSize: 11,
    color: palette.text.tertiary,
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.text.tertiary,
    width: 42,
    marginTop: 1,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.brand.primaryLight,
    width: 42,
    marginTop: 1,
  },
  messagePreview: {
    flex: 1,
    fontSize: 13,
    color: palette.text.secondary,
    lineHeight: 18,
  },
  replyPreview: {
    flex: 1,
    fontSize: 13,
    color: palette.text.primary,
    lineHeight: 18,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
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
