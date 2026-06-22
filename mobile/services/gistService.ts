/**
 * Gist API service for reading/writing the reply queue.
 * Communicates with the same GitHub Gist used by the Python backend.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Queue, QueueItem, AppState, GistResponse } from '@/types/queue';

const GIST_API = 'https://api.github.com';
const GIST_ID_KEY = 'dm_responder_gist_id';
const GH_PAT_KEY = 'dm_responder_gh_pat';
const DISCORD_TOKEN_KEY = 'dm_responder_discord_token';

const AI_API_KEY_KEY = 'ai_api_key';
const AI_BASE_URL_KEY = 'ai_base_url';
const AI_MODEL_KEY = 'ai_model';

// Fallback to in-memory storage for web
let webStorage: Record<string, string> = {};

// ─────────────────────────────────────────────────────────────
// Credential management
// ─────────────────────────────────────────────────────────────

export async function getCredentials(): Promise<{gistId: string, ghPat: string, discordToken?: string} | null> {
  try {
    let gistId, ghPat, discordToken;
    
    if (Platform.OS === 'web') {
      gistId = webStorage[GIST_ID_KEY];
      ghPat = webStorage[GH_PAT_KEY];
      discordToken = webStorage[DISCORD_TOKEN_KEY];
    } else {
      gistId = await SecureStore.getItemAsync(GIST_ID_KEY);
      ghPat = await SecureStore.getItemAsync(GH_PAT_KEY);
      discordToken = await SecureStore.getItemAsync(DISCORD_TOKEN_KEY);
    }

    // Fallback to environment variables if not set in storage
    if (!gistId || !ghPat) {
      gistId = process.env.EXPO_PUBLIC_GIST_ID || gistId;
      ghPat = process.env.EXPO_PUBLIC_GH_PAT || ghPat;
      discordToken = process.env.EXPO_PUBLIC_DISCORD_TOKEN || discordToken;
    }
    
    if (gistId && ghPat) {
      return { gistId, ghPat, discordToken: discordToken || undefined };
    }
    return null;
  } catch (err) {
    console.error("Error reading credentials", err);
    return null;
  }
}

export async function saveCredentials(gistId: string, ghPat: string, discordToken?: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage[GIST_ID_KEY] = gistId;
    webStorage[GH_PAT_KEY] = ghPat;
    if (discordToken) webStorage[DISCORD_TOKEN_KEY] = discordToken;
  } else {
    await SecureStore.setItemAsync(GIST_ID_KEY, gistId);
    await SecureStore.setItemAsync(GH_PAT_KEY, ghPat);
    if (discordToken) {
      await SecureStore.setItemAsync(DISCORD_TOKEN_KEY, discordToken);
    } else {
      await SecureStore.deleteItemAsync(DISCORD_TOKEN_KEY).catch(() => {});
    }
  }
}

export async function clearCredentials(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage = {};
  } else {
    await SecureStore.deleteItemAsync(GIST_ID_KEY);
    await SecureStore.deleteItemAsync(GH_PAT_KEY);
    await SecureStore.deleteItemAsync(DISCORD_TOKEN_KEY);
  }
}

export async function getAiCredentials(): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
  try {
    const apiKey = await SecureStore.getItemAsync(AI_API_KEY_KEY);
    const baseUrl = await SecureStore.getItemAsync(AI_BASE_URL_KEY);
    const model = await SecureStore.getItemAsync(AI_MODEL_KEY);
    if (apiKey) {
      return { 
        apiKey, 
        baseUrl: baseUrl || 'https://openrouter.ai/api/v1', 
        model: model || 'meta-llama/llama-3.1-8b-instruct' 
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAiCredentials(apiKey: string, baseUrl: string, model: string): Promise<void> {
  await SecureStore.setItemAsync(AI_API_KEY_KEY, apiKey);
  await SecureStore.setItemAsync(AI_BASE_URL_KEY, baseUrl);
  await SecureStore.setItemAsync(AI_MODEL_KEY, model);
}

export async function clearAiCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(AI_API_KEY_KEY);
  await SecureStore.deleteItemAsync(AI_BASE_URL_KEY);
  await SecureStore.deleteItemAsync(AI_MODEL_KEY);
}

// ─────────────────────────────────────────────────────────────
// Gist API operations
// ─────────────────────────────────────────────────────────────

async function fetchGist(gistId: string, ghPat: string): Promise<GistResponse | null> {
  try {
    const response = await fetch(`${GIST_API}/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${ghPat}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error(`Gist fetch failed: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Gist fetch error:', error);
    return null;
  }
}

async function updateGist(
  gistId: string,
  ghPat: string,
  filename: string,
  data: any
): Promise<boolean> {
  try {
    const response = await fetch(`${GIST_API}/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${ghPat}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [filename]: {
            content: JSON.stringify(data, null, 2),
          },
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Gist update error:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Queue operations
// ─────────────────────────────────────────────────────────────

function defaultQueue(): Queue {
  return {
    pending: [],
    approved: [],
    sent: [],
    skipped: [],
    generation_requests: [],
    last_updated: '',
  };
}

export async function fetchQueue(): Promise<Queue | null> {
  const creds = await getCredentials();
  if (!creds) return null;

  const gist = await fetchGist(creds.gistId, creds.ghPat);
  if (!gist) return null;

  const queueFile = gist.files['queue.json'];
  if (!queueFile) return defaultQueue();

  try {
    const queue = JSON.parse(queueFile.content) as Queue;
    return {
      ...defaultQueue(),
      ...queue,
    };
  } catch {
    return defaultQueue();
  }
}

export async function fetchState(): Promise<AppState | null> {
  const creds = await getCredentials();
  if (!creds) return null;

  const gist = await fetchGist(creds.gistId, creds.ghPat);
  if (!gist) return null;

  const stateFile = gist.files['state.json'];
  if (!stateFile) return null;

  try {
    return JSON.parse(stateFile.content) as AppState;
  } catch {
    return null;
  }
}

export async function fetchChannels(): Promise<import('@/types/queue').Channel[] | null> {
  const creds = await getCredentials();
  if (!creds) return null;

  const gist = await fetchGist(creds.gistId, creds.ghPat);
  if (!gist) return null;

  const channelsFile = gist.files['channels.json'];
  if (!channelsFile) return null;

  try {
    return JSON.parse(channelsFile.content) as import('@/types/queue').Channel[];
  } catch {
    return null;
  }
}

export async function approveReply(itemId: string, finalReply?: string, replyToMessageId?: string | null): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds) return false;

  const queue = await fetchQueue();
  if (!queue) return false;

  const itemIndex = queue.pending.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) return false;

  const item = queue.pending[itemIndex];
  const approvedItem: QueueItem = {
    ...item,
    status: 'approved',
    final_reply: finalReply || item.suggested_reply,
    reply_to_message_id: replyToMessageId,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Remove from pending, add to approved
  queue.pending.splice(itemIndex, 1);
  queue.approved.push(approvedItem);
  queue.last_updated = new Date().toISOString();

  return updateGist(creds.gistId, creds.ghPat, 'queue.json', queue);
}

export async function skipReply(itemId: string): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds) return false;

  const queue = await fetchQueue();
  if (!queue) return false;

  const itemIndex = queue.pending.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) return false;

  const item = queue.pending[itemIndex];
  const skippedItem: QueueItem = {
    ...item,
    status: 'skipped',
    skipped_reason: 'user_skipped',
    updated_at: new Date().toISOString(),
  };

  // Remove from pending, add to skipped
  queue.pending.splice(itemIndex, 1);
  queue.skipped.push(skippedItem);
  queue.last_updated = new Date().toISOString();

  return updateGist(creds.gistId, creds.ghPat, 'queue.json', queue);
}

export async function clearAllPendingReplies(): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds) return false;

  const queue = await fetchQueue();
  if (!queue) return false;

  if (queue.pending.length === 0) return true;

  // Move all pending items to skipped
  const now = new Date().toISOString();
  for (const item of queue.pending) {
    queue.skipped.push({
      ...item,
      status: 'skipped',
      skipped_reason: 'cleared_all',
      updated_at: now,
    });
  }
  
  queue.pending = [];
  queue.last_updated = now;

  return updateGist(creds.gistId, creds.ghPat, 'queue.json', queue);
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const creds = await getCredentials();
  if (!creds) {
    return { success: false, message: 'No credentials configured' };
  }

  const gist = await fetchGist(creds.gistId, creds.ghPat);
  if (!gist) {
    return { success: false, message: 'Cannot access Gist. Check your Gist ID and PAT.' };
  }

  const hasQueue = 'queue.json' in gist.files;
  const hasState = 'state.json' in gist.files;

  if (!hasQueue || !hasState) {
    return {
      success: false,
      message: `Gist is missing files: ${!hasQueue ? 'queue.json' : ''} ${!hasState ? 'state.json' : ''}`.trim(),
    };
  }

  return { success: true, message: 'Connected successfully!' };
}

/**
 * Get a human-readable time-ago string.
 */
export function timeAgo(dateString: string): string {
  if (!dateString) return 'never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
