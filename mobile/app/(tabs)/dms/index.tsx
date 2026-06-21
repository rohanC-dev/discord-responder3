import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { palette } from '@/constants/Colors';
import { useQueue } from './_layout';
import ReplyCard from '@/components/ReplyCard';
import { approveReply, skipReply } from '@/services/gistService';

export default function DMIndexScreen() {
  const { queue, onRefresh } = useQueue();

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

  if (!queue) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.brand.primary} />
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
            <Text style={styles.title}>Pending Suggestions</Text>
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
  title: {
    color: palette.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
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
