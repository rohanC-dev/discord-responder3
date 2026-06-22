import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/Colors';
import { useQueue } from './_layout';
import { approveReply, skipReply } from '@/services/gistService';
import { requestBackendGeneration } from '@/services/aiService';
import { fetchChannelMessages, sendDiscordMessage, DiscordMessage } from '@/services/discordService';
import type { Queue, QueueItem } from '@/types/queue';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { queue, channels, onRefresh } = useQueue();
  
  const channel = channels?.find(c => c.channel_id === id);
  const item = queue?.pending?.find(p => p.channel_id === id);
  
  const [editedReply, setEditedReply] = useState(item?.suggested_reply || '');
  const [useReplyFeature, setUseReplyFeature] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingTarget, setIsGeneratingTarget] = useState<string | null>(null);

  const [historyMessages, setHistoryMessages] = useState<DiscordMessage[] | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  // Derived properties for header and intro
  const chanName = item?.sender_name || channel?.sender_name || 'Unknown';
  const chanAvatar = item?.sender_avatar || channel?.sender_avatar;

  useEffect(() => {
    navigation.setOptions({ headerTitle: chanName });
    if (item) {
      setEditedReply(item.suggested_reply);
    }
  }, [item, chanName, navigation]);

  useEffect(() => {
    if (!item && channel) {
      setIsFetchingHistory(true);
      fetchChannelMessages(channel.channel_id)
        .then(msgs => setHistoryMessages(msgs))
        .finally(() => setIsFetchingHistory(false));
    }
  }, [item, channel]);

  if (!item && !channel) {
    return (
      <View style={styles.centerContainer}>
        <Text style={{ color: palette.text.tertiary }}>Conversation not found.</Text>
      </View>
    );
  }

  const handleAction = async (action: 'approve' | 'skip') => {
    setIsSubmitting(true);
    try {
      if (item) {
        // We have a pending item in Gist queue, process normally
        if (!queue) return;
        if (action === 'approve') {
          const replyToMessageId = useReplyFeature ? item.message_id : null;
          await approveReply(item.id, editedReply, replyToMessageId);
        } else {
          await skipReply(item.id);
        }
        onRefresh();
        router.replace('/(tabs)/dms' as any);
      } else if (channel) {
        // No item, so we are sending natively via Discord API
        if (action === 'approve') {
          if (!editedReply.trim()) return;
          const success = await sendDiscordMessage(channel.channel_id, editedReply);
          if (success) {
            setEditedReply('');
            // Refresh history
            const msgs = await fetchChannelMessages(channel.channel_id);
            if (msgs) setHistoryMessages(msgs);
            Alert.alert('Sent', 'Message sent successfully!');
          } else {
            Alert.alert('Failed', 'Could not send message. Did you add your Discord Token in Settings?');
          }
        } else {
          // 'skip' acts as a clear or back button here
          setEditedReply('');
          router.replace('/(tabs)/dms' as any);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateReply = async (targetMessage: string) => {
    const chanId = item?.channel_id || channel?.channel_id;
    if (!chanId) return;
    
    setIsGeneratingTarget(targetMessage);
    try {
      let ctx: string[] = [];
      if (item) {
        ctx = item.conversation_context || [];
      } else if (historyMessages) {
        ctx = historyMessages.map(m => {
           const isMe = m.author.id !== channel?.sender_id;
           return `${isMe ? 'You' : chanName}: ${m.content}`;
        });
      }
      
      const generated = await requestBackendGeneration(
        chanId,
        targetMessage,
        chanName,
        ctx
      );
      if (generated) {
        setEditedReply(generated);
      }
    } catch (err: any) {
      Alert.alert('Generation Error', err.message);
    } finally {
      setIsGeneratingTarget(null);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Intro Section */}
        <View style={styles.introContainer}>
          {chanAvatar ? (
            <Image source={{ uri: chanAvatar }} style={styles.introAvatar} />
          ) : (
            <View style={[styles.introAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{chanName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.introTitle}>{chanName}</Text>
          <Text style={styles.introSubtitle}>This is the beginning of your direct message history with @{chanName}.</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {isFetchingHistory && (
          <ActivityIndicator size="large" color={palette.brand.primary} style={{ marginTop: 20 }} />
        )}

        {/* Conversation Context (From Queue Item) */}
        {item && item.conversation_context?.map((msg, index) => {
          const isMe = msg.startsWith('You:') || msg.startsWith('Me:') || !msg.startsWith(`${item.sender_name}:`);
          const content = msg.split(': ').slice(1).join(': ') || msg;
          const sender = isMe ? 'You' : item.sender_name;

          return (
            <View key={`ctx-${index}`} style={styles.messageRow}>
              {isMe ? (
                <View style={[styles.messageAvatar, styles.avatarFallbackSmall, { backgroundColor: palette.brand.primary }]}>
                  <Text style={styles.avatarFallbackTextSmall}>Me</Text>
                </View>
              ) : (
                item.sender_avatar ? 
                  <Image source={{ uri: item.sender_avatar }} style={styles.messageAvatar} /> :
                  <View style={[styles.messageAvatar, styles.avatarFallbackSmall]}>
                    <Text style={styles.avatarFallbackTextSmall}>{item.sender_name.charAt(0).toUpperCase()}</Text>
                  </View>
              )}
              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageSender}>{sender}</Text>
                  {!isMe && (
                    <Pressable 
                      style={({pressed}) => [styles.generateButton, pressed && styles.generateButtonPressed]}
                      onPress={() => handleGenerateReply(content)}
                      disabled={!!isGeneratingTarget}
                    >
                      {isGeneratingTarget === content ? (
                        <ActivityIndicator size="small" color={palette.brand.primary} />
                      ) : (
                        <Ionicons name="sparkles" size={14} color={palette.brand.primary} />
                      )}
                    </Pressable>
                  )}
                </View>
                <Text style={styles.messageText}>{content}</Text>
              </View>
            </View>
          );
        })}

        {/* History Messages (When no Queue Item) */}
        {!item && historyMessages?.map((msg) => {
          const isMe = channel ? msg.author.id !== channel.sender_id : false;
          const sender = isMe ? 'You' : chanName;
          const content = msg.content;
          
          return (
            <View key={`hist-${msg.id}`} style={styles.messageRow}>
              {isMe ? (
                <View style={[styles.messageAvatar, styles.avatarFallbackSmall, { backgroundColor: palette.brand.primary }]}>
                  <Text style={styles.avatarFallbackTextSmall}>Me</Text>
                </View>
              ) : (
                chanAvatar ? 
                  <Image source={{ uri: chanAvatar }} style={styles.messageAvatar} /> :
                  <View style={[styles.messageAvatar, styles.avatarFallbackSmall]}>
                    <Text style={styles.avatarFallbackTextSmall}>{sender.charAt(0).toUpperCase()}</Text>
                  </View>
              )}
              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageSender}>{sender}</Text>
                  {!isMe && (
                    <Pressable 
                      style={({pressed}) => [styles.generateButton, pressed && styles.generateButtonPressed]}
                      onPress={() => handleGenerateReply(content)}
                      disabled={!!isGeneratingTarget}
                    >
                      {isGeneratingTarget === content ? (
                        <ActivityIndicator size="small" color={palette.brand.primary} />
                      ) : (
                        <Ionicons name="sparkles" size={14} color={palette.brand.primary} />
                      )}
                    </Pressable>
                  )}
                </View>
                <Text style={styles.messageText}>{content}</Text>
              </View>
            </View>
          );
        })}

        {/* Original Message (Only when we have a pending item) */}
        {item && (
          <View style={styles.messageRow}>
            {item.sender_avatar ? 
              <Image source={{ uri: item.sender_avatar }} style={styles.messageAvatar} /> :
              <View style={[styles.messageAvatar, styles.avatarFallbackSmall]}><Text style={styles.avatarFallbackTextSmall}>{item.sender_name.charAt(0).toUpperCase()}</Text></View>
            }
            <View style={styles.messageContent}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageSender}>{item.sender_name}</Text>
                <Pressable 
                  style={({pressed}) => [styles.generateButton, pressed && styles.generateButtonPressed]}
                  onPress={() => handleGenerateReply(item.original_message)}
                  disabled={!!isGeneratingTarget}
                >
                  {isGeneratingTarget === item.original_message ? (
                    <ActivityIndicator size="small" color={palette.brand.primary} />
                  ) : (
                    <Ionicons name="sparkles" size={14} color={palette.brand.primary} />
                  )}
                </Pressable>
              </View>
              <Text style={styles.messageText}>{item.original_message}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.replyOptionsContainer}>
          <Text style={styles.replyOptionsText}>Reply to original message</Text>
          <Switch
            value={useReplyFeature}
            onValueChange={setUseReplyFeature}
            trackColor={{ false: palette.dark.border, true: palette.brand.primary }}
            thumbColor={'#fff'}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
        <View style={styles.inputContainer}>
          <Pressable 
            style={styles.actionButton} 
            onPress={() => handleAction('skip')}
            disabled={isSubmitting}
          >
            <Ionicons name={item ? "close-circle" : "close"} size={24} color={palette.text.tertiary} />
          </Pressable>
          
          <TextInput
            style={styles.textInput}
            value={editedReply}
            onChangeText={setEditedReply}
            multiline
            placeholder={item ? "Message..." : "Send direct message..."}
            placeholderTextColor={palette.text.tertiary}
            editable={!isSubmitting}
          />
          
          <Pressable 
            style={[styles.sendButton, !editedReply.trim() && styles.sendButtonDisabled]} 
            onPress={() => handleAction('approve')}
            disabled={isSubmitting || !editedReply.trim()}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  introContainer: {
    alignItems: 'flex-start',
    marginTop: 40,
    marginBottom: 24,
  },
  introAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatarFallback: {
    backgroundColor: palette.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: palette.text.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  introTitle: {
    color: palette.text.primary,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  introSubtitle: {
    color: palette.text.secondary,
    fontSize: 16,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: palette.dark.border,
    marginBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
    marginTop: 4,
  },
  avatarFallbackSmall: {
    backgroundColor: palette.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackTextSmall: {
    color: palette.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  generateButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: palette.brand.primary + '15',
  },
  generateButtonPressed: {
    opacity: 0.6,
  },
  messageSender: {
    color: palette.text.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  messageText: {
    color: palette.text.secondary,
    fontSize: 16,
    lineHeight: 22,
  },
  inputArea: {
    backgroundColor: palette.dark.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.dark.border,
  },
  replyOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  replyOptionsText: {
    color: palette.text.secondary,
    fontSize: 14,
    marginRight: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.dark.surfaceLight,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  actionButton: {
    padding: 4,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: palette.text.primary,
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButton: {
    backgroundColor: palette.brand.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: palette.text.tertiary,
    opacity: 0.5,
  },
});
