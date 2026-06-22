import { getCredentials } from './gistService';

export interface DiscordMessage {
  id: string;
  type: number;
  content: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
  };
  timestamp: string;
}

export async function fetchChannelMessages(channelId: string, limit: number = 20): Promise<DiscordMessage[] | null> {
  const creds = await getCredentials();
  if (!creds || !creds.discordToken) {
    return null;
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, {
      headers: {
        'Authorization': creds.discordToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Discord API Error: ${response.status} ${response.statusText}`);
      return null;
    }

    const messages = await response.json() as DiscordMessage[];
    // Discord returns messages newest-first. Let's reverse them to oldest-first to match the UI flow.
    return messages.reverse();
  } catch (err) {
    console.error('Failed to fetch Discord messages:', err);
    return null;
  }
}

export async function sendDiscordMessage(channelId: string, content: string, replyToMessageId?: string | null): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds || !creds.discordToken) {
    return false;
  }

  const payload: any = { content };
  if (replyToMessageId) {
    payload.message_reference = { message_id: replyToMessageId };
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': creds.discordToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`Discord API Error: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send Discord message:', err);
    return false;
  }
}
