"""
Discord HTTP API client for reading DMs and sending messages.
Uses raw requests — no discord.py dependency needed.
"""

import time
import requests
import config

# Session for connection pooling
_session = requests.Session()
_session.headers.update({
    "Authorization": config.DISCORD_TOKEN,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
})

# Rate limit tracking
_rate_limit_remaining = 5
_rate_limit_reset = 0


def _handle_rate_limit(response: requests.Response):
    """Track rate limit headers and sleep if needed."""
    global _rate_limit_remaining, _rate_limit_reset

    _rate_limit_remaining = int(response.headers.get("X-RateLimit-Remaining", 5))
    _rate_limit_reset = float(response.headers.get("X-RateLimit-Reset", 0))

    if response.status_code == 429:
        retry_after = response.json().get("retry_after", 5)
        print(f"⏳ Rate limited. Waiting {retry_after}s...")
        time.sleep(retry_after + 0.5)
        return True  # Signal to retry

    if _rate_limit_remaining <= 1:
        wait = max(0, _rate_limit_reset - time.time()) + 0.5
        if wait > 0:
            print(f"⏳ Rate limit approaching. Waiting {wait:.1f}s...")
            time.sleep(wait)

    return False


def _api_request(method: str, endpoint: str, **kwargs) -> requests.Response | None:
    """Make a Discord API request with rate limit handling and retries."""
    url = f"{config.DISCORD_API_BASE}{endpoint}"

    for attempt in range(3):
        try:
            response = _session.request(method, url, **kwargs)

            if _handle_rate_limit(response):
                continue  # Retry after rate limit

            if response.status_code == 200 or response.status_code == 201:
                return response
            elif response.status_code == 204:
                return response
            elif response.status_code == 401:
                print("❌ Discord authentication failed. Check DISCORD_TOKEN.")
                return None
            elif response.status_code == 403:
                print(f"❌ Forbidden: {endpoint}")
                return None
            else:
                print(f"⚠️  Discord API error {response.status_code}: {response.text[:200]}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return None

        except requests.RequestException as e:
            print(f"⚠️  Request error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return None

    return None


def get_dm_channels() -> list[dict]:
    """
    Fetch all DM channels for the authenticated user.
    Returns a list of DM channel objects, each containing:
    - id: channel ID
    - recipients: list of user objects
    - last_message_id: ID of the last message
    """
    response = _api_request("GET", "/users/@me/channels")
    if response is None:
        return []

    channels = response.json()

    # Filter to only 1-on-1 DMs (type 1), not group DMs (type 3)
    dm_channels = [ch for ch in channels if ch.get("type") == 1]

    # Apply whitelist/blacklist filtering
    if config.WHITELIST_USER_IDS:
        dm_channels = [
            ch for ch in dm_channels
            if any(r["id"] in config.WHITELIST_USER_IDS for r in ch.get("recipients", []))
        ]

    if config.BLACKLIST_USER_IDS:
        dm_channels = [
            ch for ch in dm_channels
            if not any(r["id"] in config.BLACKLIST_USER_IDS for r in ch.get("recipients", []))
        ]

    print(f"📬 Found {len(dm_channels)} DM channels")
    return dm_channels


def get_messages(channel_id: str, after: str | None = None, limit: int = 50) -> list[dict]:
    """
    Fetch messages from a DM channel.
    
    Args:
        channel_id: The DM channel ID
        after: Only fetch messages after this message ID (for pagination)
        limit: Max messages to fetch (1-100)
    
    Returns:
        List of message objects sorted oldest-first
    """
    params = {"limit": min(limit, 100)}
    if after:
        params["after"] = after

    response = _api_request("GET", f"/channels/{channel_id}/messages", params=params)
    if response is None:
        return []

    messages = response.json()

    # Discord returns newest-first, reverse to oldest-first
    messages.reverse()
    return messages


def get_conversation_history(channel_id: str, limit: int | None = None) -> list[dict]:
    """
    Fetch full conversation history for a DM channel.
    Used to build context for AI reply generation.
    
    Returns messages sorted oldest-first.
    """
    if limit is None:
        limit = config.MAX_HISTORY_MESSAGES

    all_messages = []
    before = None

    while len(all_messages) < limit:
        batch_size = min(100, limit - len(all_messages))
        params = {"limit": batch_size}
        if before:
            params["before"] = before

        response = _api_request("GET", f"/channels/{channel_id}/messages", params=params)
        if response is None:
            break

        batch = response.json()
        if not batch:
            break

        all_messages.extend(batch)
        before = batch[-1]["id"]  # Discord returns newest-first

        if len(batch) < batch_size:
            break  # No more messages

        time.sleep(0.5)  # Be gentle with rate limits

    # Reverse to get oldest-first ordering
    all_messages.reverse()

    # Trim to limit
    if len(all_messages) > limit:
        all_messages = all_messages[-limit:]

    return all_messages


def send_message(channel_id: str, content: str) -> dict | None:
    """
    Send a message to a DM channel.
    
    Args:
        channel_id: The DM channel ID
        content: Message text to send
    
    Returns:
        The sent message object, or None on failure
    """
    response = _api_request(
        "POST",
        f"/channels/{channel_id}/messages",
        json={"content": content}
    )

    if response is None:
        print(f"❌ Failed to send message to channel {channel_id}")
        return None

    result = response.json()
    print(f"✅ Message sent to channel {channel_id}: {content[:50]}...")
    return result


def get_user_info() -> dict | None:
    """Get info about the authenticated user."""
    response = _api_request("GET", "/users/@me")
    if response is None:
        return None
    return response.json()


def get_channel_recipient(channel: dict) -> dict | None:
    """Extract the other user from a DM channel object."""
    recipients = channel.get("recipients", [])
    if recipients:
        return recipients[0]
    return None


def format_avatar_url(user: dict) -> str:
    """Build a CDN avatar URL for a user."""
    user_id = user.get("id", "")
    avatar = user.get("avatar")
    if avatar:
        ext = "gif" if avatar.startswith("a_") else "png"
        return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar}.{ext}?size=128"
    # Default avatar based on discriminator
    discriminator = user.get("discriminator", "0")
    if discriminator == "0":
        # New username system — use user ID
        index = (int(user_id) >> 22) % 6
    else:
        index = int(discriminator) % 5
    return f"https://cdn.discordapp.com/embed/avatars/{index}.png"
