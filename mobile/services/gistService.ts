/**
 * Gist API service for reading/writing the reply queue.
 * Communicates with the same GitHub Gist used by the Python backend.
 */

import * as SecureStore from 'expo-secure-store';
import { Queue, QueueItem, AppState, GistResponse } from '@/types/queue';

const GIST_API = 'https://api.github.com';
const GIST_ID_KEY = 'gist_id';
const GH_PAT_KEY = 'gh_pat';

// ─────────────────────────────────────────────────────────────
// Credential management
// ─────────────────────────────────────────────────────────────

export async function getCredentials(): Promise<{ gistId: string; ghPat: string } | null> {
  try {
    const gistId = await SecureStore.getItemAsync(GIST_ID_KEY);
    const ghPat = await SecureStore.getItemAsync(GH_PAT_KEY);
    if (gistId && ghPat) {
      return { gistId, ghPat };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveCredentials(gistId: string, ghPat: string): Promise<void> {
  await SecureStore.setItemAsync(GIST_ID_KEY, gistId);
  await SecureStore.setItemAsync(GH_PAT_KEY, ghPat);
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(GIST_ID_KEY);
  await SecureStore.deleteItemAsync(GH_PAT_KEY);
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

export async function approveReply(itemId: string, finalReply?: string): Promise<boolean> {
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
