import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useFocusEffect, useRouter, usePathname } from 'expo-router';
import { useState, useCallback, createContext, useContext } from 'react';

import { palette } from '@/constants/Colors';
import { fetchQueue } from '@/services/gistService';
import type { Queue, PendingReply } from '@/types/queue';

// Provide queue data to child screens
export const QueueContext = createContext<{
  queue: Queue | null;
  refreshing: boolean;
  onRefresh: () => void;
}>({ queue: null, refreshing: false, onRefresh: () => {} });

export function useQueue() {
  return useContext(QueueContext);
}

function CustomDrawerContent(props: any) {
  const { queue, refreshing, onRefresh } = useQueue();
  const router = useRouter();
  const pathname = usePathname();

  // Get unique senders from pending replies
  const pendingItems = queue?.pending || [];
  
  // Group by channel_id (or sender_id)
  const uniqueConversations = pendingItems.reduce((acc, curr) => {
    if (!acc.find(item => item.channel_id === curr.channel_id)) {
      acc.push(curr);
    }
    return acc;
  }, [] as PendingReply[]);

  return (
    <DrawerContentScrollView 
      {...props} 
      style={styles.drawerContainer}
      contentContainerStyle={{ paddingTop: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.brand.primary} />}
    >
      <Text style={styles.drawerTitle}>DIRECT MESSAGES</Text>
      
      {uniqueConversations.length === 0 && !refreshing && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending replies.</Text>
        </View>
      )}

      {uniqueConversations.map((item) => {
        const isActive = pathname === `/dms/${item.id}`;
        
        return (
          <Pressable
            key={item.id}
            style={[styles.friendItem, isActive && styles.friendItemActive]}
            onPress={() => {
              router.push(`/dms/${item.id}`);
              props.navigation.closeDrawer();
            }}
          >
            <View style={styles.avatarContainer}>
              {item.sender_avatar ? (
                <Image source={{ uri: item.sender_avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {item.sender_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Online status dot */}
              <View style={styles.statusDot} />
            </View>
            <Text style={[styles.friendName, isActive && styles.friendNameActive]} numberOfLines={1}>
              {item.sender_name}
            </Text>
          </Pressable>
        );
      })}
    </DrawerContentScrollView>
  );
}

export default function DMLayout() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchQueue();
      setQueue(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueueContext.Provider value={{ queue, refreshing, onRefresh: () => loadData(true) }}>
        <Drawer
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerStyle: {
              backgroundColor: palette.dark.surface,
              shadowColor: 'transparent',
              elevation: 0,
              borderBottomWidth: 1,
              borderBottomColor: palette.dark.border,
            },
            headerTintColor: palette.text.primary,
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 16,
            },
            drawerStyle: {
              backgroundColor: palette.dark.surface,
              width: 280,
            },
          }}
        >
          {/* Default entry screen when no DM is selected */}
          <Drawer.Screen 
            name="index" 
            options={{ 
              title: 'Friends',
              headerTitle: 'Direct Messages'
            }} 
          />
          
          {/* Dynamic route for specific chats */}
          <Drawer.Screen 
            name="[id]" 
            options={{ 
              headerTitle: '', // Will be set dynamically by the screen
            }} 
          />
        </Drawer>
      </QueueContext.Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: palette.dark.surfaceDark,
  },
  drawerTitle: {
    color: palette.text.tertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: palette.text.tertiary,
    fontSize: 14,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
  },
  friendItemActive: {
    backgroundColor: palette.dark.surfaceLight,
  },
  avatarContainer: {
    marginRight: 12,
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    backgroundColor: palette.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: palette.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.brand.success,
    borderWidth: 2,
    borderColor: palette.dark.surfaceDark,
  },
  friendName: {
    color: palette.text.secondary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  friendNameActive: {
    color: palette.text.primary,
    fontWeight: '600',
  },
});
