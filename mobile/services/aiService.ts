/**
 * AI Service — submits generation requests to the backend via Gist.
 * 
 * Flow:
 * 1. Mobile writes a generation request to queue.generation_requests
 * 2. Backend Python runner picks it up within ~5 seconds
 * 3. Backend generates the reply and writes result back to the Gist
 * 4. Mobile polls the Gist until the request status is "completed"
 */
import { getCredentials } from './gistService';
import type { Queue } from '@/types/queue';

const GIST_API = 'https://api.github.com';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // 40 * 3s = 2 minutes max wait

export interface GenerationRequest {
  id: string;
  channel_id: string;
  target_message: string;
  sender_name: string;
  context: string[];
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

function generateId(): string {
  return 'gen_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Submit a generation request and poll until the backend processes it.
 */
export async function requestBackendGeneration(
  channelId: string,
  targetMessage: string,
  senderName: string,
  context: string[]
): Promise<string> {
  const creds = await getCredentials();
  if (!creds) throw new Error('Not connected. Configure credentials in Settings.');

  // 1. Read current queue
  const queue = await readQueue(creds.gistId, creds.ghPat);
  if (!queue) throw new Error('Could not read queue from Gist.');

  // 2. Create the generation request
  const request: GenerationRequest = {
    id: generateId(),
    channel_id: channelId,
    target_message: targetMessage,
    sender_name: senderName,
    context,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  // 3. Append to generation_requests and save
  if (!queue.generation_requests) {
    queue.generation_requests = [];
  }
  queue.generation_requests.push(request);
  queue.last_updated = new Date().toISOString();

  const saved = await writeQueue(creds.gistId, creds.ghPat, queue);
  if (!saved) throw new Error('Failed to save generation request to Gist.');

  // 4. Poll until the backend processes the request
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const updatedQueue = await readQueue(creds.gistId, creds.ghPat);
    if (!updatedQueue) continue;

    const reqs = updatedQueue.generation_requests || [];
    const found = reqs.find((r: any) => r.id === request.id);

    if (!found) continue;

    if (found.status === 'completed' && found.result) {
      // Clean up: remove the completed request from queue
      updatedQueue.generation_requests = reqs.filter((r: any) => r.id !== request.id);
      updatedQueue.last_updated = new Date().toISOString();
      await writeQueue(creds.gistId, creds.ghPat, updatedQueue);
      return found.result;
    }

    if (found.status === 'failed') {
      // Clean up: remove the failed request from queue
      updatedQueue.generation_requests = reqs.filter((r: any) => r.id !== request.id);
      updatedQueue.last_updated = new Date().toISOString();
      await writeQueue(creds.gistId, creds.ghPat, updatedQueue);
      throw new Error(found.error || 'Backend failed to generate reply.');
    }
  }

  throw new Error('Timed out waiting for backend to generate reply. Is the Actions workflow running?');
}

// ─── Helpers ───────────────────────────────────────────────

async function readQueue(gistId: string, ghPat: string): Promise<any | null> {
  try {
    const response = await fetch(`${GIST_API}/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${ghPat}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) return null;
    const gist = await response.json();
    const queueFile = gist.files['queue.json'];
    if (!queueFile) return null;
    return JSON.parse(queueFile.content);
  } catch {
    return null;
  }
}

async function writeQueue(gistId: string, ghPat: string, queue: any): Promise<boolean> {
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
          'queue.json': {
            content: JSON.stringify(queue, null, 2),
          },
        },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
