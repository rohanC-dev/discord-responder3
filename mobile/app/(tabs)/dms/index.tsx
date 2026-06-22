import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Pressable } from 'react-native';
import { palette } from '@/constants/Colors';
import { useQueue } from './_layout';
import ReplyCard from '@/components/ReplyCard';
import { approveReply, skipReply, clearAllPendingReplies } from '@/services/gistService';

export default function DMIndexScreen() {
  const { queue, isLoading, onRefresh } = useQueue();

  const handleApprove = async (itemId: string) => {
    try {
      await approveReply(itemId);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSkip = async (itemId: string) => {
    try {
      await skipReply(itemId);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Suggestions",
      "Are you sure you want to dismiss all pending AI suggestions? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllPendingReplies();
              onRefresh();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.brand.primary} />
      </View>
    );
  }

  if (!queue) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>Not Connected</Text>
        <Text style={styles.emptyText}>
          Please configure your Gist ID and GitHub PAT in the Settings tab to connect to your auto-responder pipeline.
        </Text>
      </View>
    );
  }

  const pendingCount = queue.pending?.length || 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={queue.pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Text style={styles.title}>Pending Suggestions</Text>
              {pendingCount > 0 && (
                <Pressable style={styles.clearAllButton} onPress={handleClearAll}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.subtitle}>
              {pendingCount} message{pendingCount !== 1 ? 's' : ''} waiting for your review.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReplyCard
            item={item}
            onApprove={handleApprove}
            onSkip={handleSkip}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You're all caught up! No pending replies.</Text>
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
  centerContainer: {
    flex: 1,
    backgroundColor: palette.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clearAllButton: {
    backgroundColor: palette.dark.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearAllText: {
    color: palette.brand.error,
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: palette.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: palette.text.secondary,
    fontSize: 15,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: palette.text.tertiary,
    fontSize: 16,
    textAlign: 'center',
  },
});
