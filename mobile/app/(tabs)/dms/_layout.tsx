import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useFocusEffect, useRouter, usePathname } from 'expo-router';
import { useState, useCallback, createContext, useContext } from 'react';

import { palette } from '@/constants/Colors';
import { fetchQueue, fetchState } from '@/services/gistService';
import type { Queue, QueueItem, AppState } from '@/types/queue';

// Provide queue data to child screens
export const QueueContext = createContext<{
  queue: Queue | null;
  appState: AppState | null;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}>({ queue: null, appState: null, isLoading: true, refreshing: false, onRefresh: () => {} });

export function useQueue() {
  return useContext(QueueContext);
}

function CustomDrawerContent(props: any) {
  const { queue, appState, refreshing, onRefresh } = useQueue();
  const router = useRouter();
  const pathname = usePathname();

  // Get unique senders from pending replies
  const pendingItems = queue?.pending || [];
  
  // Group by channel_id and count pending messages
  const convMap = new Map<string, { item: QueueItem; count: number }>();
  pendingItems.forEach(curr => {
    if (convMap.has(curr.channel_id)) {
      convMap.get(curr.channel_id)!.count++;
    } else {
      convMap.set(curr.channel_id, { item: curr, count: 1 });
    }
  });

  const uniqueConversations = Array.from(convMap.values())
    .sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime());

  // Determine workflow status
  let isWorkflowRunning = false;
  let workflowDuration = '';
  
  if (appState?.last_ping_time && appState?.workflow_start_time) {
    const lastPing = new Date(appState.last_ping_time).getTime();
    const now = Date.now();
    // If it pinged within the last 2 minutes, consider it running
    if (now - lastPing < 2 * 60 * 1000) {
      isWorkflowRunning = true;
      const start = new Date(appState.workflow_start_time).getTime();
      const diffMin = Math.floor((now - start) / 60000);
      if (diffMin < 60) {
        workflowDuration = `${diffMin}m`;
      } else {
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        workflowDuration = `${hours}h ${mins}m`;
      }
    }
  }

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

      {uniqueConversations.map(({ item, count }) => {
        const isActive = pathname === `/dms/${item.id}`;
        
        return (
          <Pressable
            key={item.id}
            style={[styles.friendItem, isActive && styles.friendItemActive]}
            onPress={() => {
              router.push(`/(tabs)/dms/${item.id}` as any);
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
            </View>
            <Text style={[styles.friendName, isActive && styles.friendNameActive]} numberOfLines={1}>
              {item.sender_name}
            </Text>
            {count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
      
      {/* Workflow Status Indicator */}
      <View style={styles.workflowStatusContainer}>
        <View style={[styles.statusDot, { backgroundColor: isWorkflowRunning ? palette.brand.success : palette.text.tertiary }]} />
        <View>
          <Text style={styles.workflowStatusText}>
            Backend: {isWorkflowRunning ? 'Running' : 'Stopped'}
          </Text>
          {isWorkflowRunning && (
            <Text style={styles.workflowDurationText}>Uptime: {workflowDuration}</Text>
          )}
        </View>
      </View>
    </DrawerContentScrollView>
  );
}

export default function DMLayout() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);
    try {
      const [queueData, stateData] = await Promise.all([fetchQueue(), fetchState()]);
      setQueue(queueData);
      setAppState(stateData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
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
      <QueueContext.Provider value={{ queue, appState, isLoading, refreshing, onRefresh: () => loadData(true) }}>
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
  badge: {
    backgroundColor: palette.brand.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
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
  workflowStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: palette.dark.border,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  workflowStatusText: {
    color: palette.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  workflowDurationText: {
    color: palette.text.tertiary,
    fontSize: 11,
    marginTop: 2,
  },
});
