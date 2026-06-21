/**
 * Type definitions for the Gist-based queue system.
 */

export interface QueueItem {
  id: string;
  channel_id: string;
  sender_name: string;
  sender_id: string;
  sender_avatar: string;
  original_message: string;
  conversation_context: string[];
  suggested_reply: string;
  status: 'pending' | 'approved' | 'sent' | 'skipped' | 'expired';
  created_at: string;
  updated_at: string;
  // Added by mobile app when approving
  final_reply?: string;
  approved_at?: string;
  // Added when sent
  sent_at?: string;
  // Added when skipped
  skipped_reason?: string;
}

export interface Queue {
  pending: QueueItem[];
  approved: QueueItem[];
  sent: QueueItem[];
  skipped: QueueItem[];
  last_updated: string;
}

export interface AppState {
  last_checked: Record<string, string>;
  processed_message_ids: string[];
  run_count: number;
  last_run: string;
}

export interface GistFile {
  filename: string;
  content: string;
  language: string;
  raw_url: string;
  size: number;
}

export interface GistResponse {
  id: string;
  files: Record<string, GistFile>;
  updated_at: string;
}
