import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import { useQueue } from './_layout';

export default function DMIndexScreen() {
  const { queue } = useQueue();
  const pendingCount = queue?.pending?.length || 0;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="chatbubble-ellipses-outline" size={64} color={palette.text.tertiary} />
        <Text style={styles.title}>Direct Messages</Text>
        <Text style={styles.subtitle}>
          {pendingCount > 0 
            ? `You have ${pendingCount} pending replies.\nSwipe right or use the menu to select a friend.` 
            : `You're all caught up! No pending replies.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
    maxWidth: 300,
  },
  title: {
    color: palette.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    color: palette.text.tertiary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
