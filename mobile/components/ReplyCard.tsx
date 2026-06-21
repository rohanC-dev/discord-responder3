/**
 * ReplyCard — Premium card component for displaying a DM reply suggestion.
 * Shows sender avatar, original message, AI suggestion, and action buttons.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { QueueItem } from '@/types/queue';
import { timeAgo } from '@/services/gistService';
import { palette } from '@/constants/Colors';

interface ReplyCardProps {
  item: QueueItem;
  onApprove: (id: string, reply: string) => void;
  onSkip: (id: string) => void;
  isProcessing?: boolean;
}

export default function ReplyCard({ item, onApprove, onSkip, isProcessing }: ReplyCardProps) {
  const [editedReply, setEditedReply] = useState(item.suggested_reply);
  const [isEditing, setIsEditing] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const handleApprove = () => {
    onApprove(item.id, editedReply);
  };

  const handleSkip = () => {
    onSkip(item.id);
  };

  const statusColor = {
    pending: palette.brand.warning,
    approved: palette.brand.success,
    sent: palette.brand.secondary,
    skipped: palette.text.tertiary,
    expired: palette.brand.error,
  }[item.status];

  return (
    <View style={styles.card}>
      {/* Status indicator bar */}
      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />

      {/* Header: Avatar + Name + Time */}
      <View style={styles.header}>
        <Image
          source={{ uri: item.sender_avatar }}
          style={styles.avatar}
          defaultSource={require('@/assets/images/icon.png')}
        />
        <View style={styles.headerText}>
          <Text style={styles.senderName}>{item.sender_name}</Text>
          <Text style={styles.timestamp}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Context toggle */}
      {item.conversation_context && item.conversation_context.length > 0 && (
        <Pressable
          style={styles.contextToggle}
          onPress={() => setShowContext(!showContext)}
        >
          <Text style={styles.contextToggleText}>
            {showContext ? '▼ Hide context' : '▶ Show conversation context'}
          </Text>
        </Pressable>
      )}

      {/* Context messages */}
      {showContext && item.conversation_context && (
        <View style={styles.contextContainer}>
          {item.conversation_context.map((msg, idx) => (
            <Text key={idx} style={styles.contextMessage} numberOfLines={2}>
              {msg}
            </Text>
          ))}
        </View>
      )}

      {/* Original message bubble */}
      <View style={styles.messageBubbleIncoming}>
        <Text style={styles.bubbleLabel}>Their message</Text>
        <Text style={styles.messageText}>{item.original_message}</Text>
      </View>

      {/* AI Suggested reply bubble */}
      <View style={styles.messageBubbleOutgoing}>
        <Text style={styles.bubbleLabelOutgoing}>AI Suggestion</Text>
        {isEditing ? (
          <TextInput
            style={styles.editInput}
            value={editedReply}
            onChangeText={setEditedReply}
            multiline
            autoFocus
            placeholderTextColor={palette.text.tertiary}
          />
        ) : (
          <Text style={styles.messageTextOutgoing}>{editedReply}</Text>
        )}
      </View>

      {/* Action buttons */}
      {item.status === 'pending' && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.skipButton,
              pressed && styles.buttonPressed,
              isProcessing && styles.buttonDisabled,
            ]}
            onPress={handleSkip}
            disabled={isProcessing}
          >
            <Text style={styles.skipButtonText}>⏭️ Skip</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.editButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? '✓ Done' : '✏️ Edit'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.approveButton,
              pressed && styles.buttonPressed,
              isProcessing && styles.buttonDisabled,
            ]}
            onPress={handleApprove}
            disabled={isProcessing}
          >
            <Text style={styles.approveButtonText}>✅ Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.dark.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.dark.border,
  },
  statusBar: {
    height: 3,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.dark.surfaceLight,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text.primary,
    letterSpacing: 0.3,
  },
  timestamp: {
    fontSize: 12,
    color: palette.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  contextToggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  contextToggleText: {
    fontSize: 12,
    color: palette.brand.primary,
    fontWeight: '600',
  },
  contextContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: palette.dark.background,
    borderRadius: 10,
  },
  contextMessage: {
    fontSize: 12,
    color: palette.text.tertiary,
    marginBottom: 4,
    lineHeight: 16,
  },
  messageBubbleIncoming: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: palette.dark.surfaceLight,
    borderRadius: 14,
    borderTopLeftRadius: 4,
  },
  messageBubbleOutgoing: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: palette.brand.primary + '18',
    borderRadius: 14,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: palette.brand.primary + '30',
  },
  bubbleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bubbleLabelOutgoing: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    color: palette.text.primary,
    lineHeight: 22,
  },
  messageTextOutgoing: {
    fontSize: 15,
    color: palette.text.primary,
    lineHeight: 22,
  },
  editInput: {
    fontSize: 15,
    color: palette.text.primary,
    lineHeight: 22,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: palette.brand.primary,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: palette.dark.surfaceLight,
    borderWidth: 1,
    borderColor: palette.dark.border,
  },
  editButton: {
    backgroundColor: palette.dark.surfaceLight,
    borderWidth: 1,
    borderColor: palette.brand.primary + '40',
  },
  approveButton: {
    backgroundColor: palette.brand.success + '20',
    borderWidth: 1,
    borderColor: palette.brand.success + '40',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text.secondary,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.brand.primary,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.brand.success,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
