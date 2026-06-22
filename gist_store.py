"""
GitHub Gist storage for shared state between Actions and mobile app.
Manages two files in a single Gist:
  - queue.json: Pending/approved/sent/skipped reply suggestions
  - state.json: Last-checked timestamps per channel, processed message IDs
"""

import json
import time
import requests
import config

GIST_API_BASE = "https://api.github.com"

# Session for connection pooling
_session = requests.Session()
_session.headers.update({
    "Authorization": f"token {config.GH_PAT}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "discord-dm-responder"
})


def _default_queue() -> dict:
    """Return the default empty queue structure."""
    return {
        "pending": [],
        "approved": [],
        "sent": [],
        "skipped": [],
        "generation_requests": [],
        "last_updated": ""
    }


def _default_state() -> dict:
    """Return the default empty state structure."""
    return {
        "last_checked": {},
        "processed_message_ids": [],
        "run_count": 0,
        "last_run": ""
    }


def read_gist(filename: str) -> dict:
    """
    Read and parse a JSON file from the configured Gist.
    
    Args:
        filename: The file to read (e.g., 'queue.json', 'state.json')
    
    Returns:
        Parsed JSON as a dict. Returns default structure if file is empty/missing.
    """
    url = f"{GIST_API_BASE}/gists/{config.GIST_ID}"

    for attempt in range(3):
        try:
            response = _session.get(url)

            if response.status_code == 404:
                print(f"❌ Gist not found: {config.GIST_ID}")
                print("   Create a gist at https://gist.github.com with queue.json and state.json")
                return _get_default(filename)

            if response.status_code == 401:
                print("❌ GitHub authentication failed. Check GH_PAT.")
                return _get_default(filename)

            if response.status_code != 200:
                print(f"⚠️  Gist read error {response.status_code}: {response.text[:200]}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return _get_default(filename)

            gist_data = response.json()
            files = gist_data.get("files", {})

            if filename not in files:
                print(f"⚠️  File {filename} not found in Gist. Creating with defaults.")
                default = _get_default(filename)
                write_gist(filename, default)
                return default

            content = files[filename].get("content", "{}")
            try:
                data = json.loads(content)
                return data
            except json.JSONDecodeError:
                print(f"⚠️  Invalid JSON in {filename}. Resetting to defaults.")
                default = _get_default(filename)
                write_gist(filename, default)
                return default

        except requests.RequestException as e:
            print(f"⚠️  Gist request error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)

    return _get_default(filename)


def write_gist(filename: str, data: dict) -> bool:
    """
    Write JSON data to a file in the configured Gist.
    
    Args:
        filename: The file to write (e.g., 'queue.json', 'state.json')
        data: Dictionary to serialize to JSON
    
    Returns:
        True if successful, False otherwise
    """
    url = f"{GIST_API_BASE}/gists/{config.GIST_ID}"

    payload = {
        "files": {
            filename: {
                "content": json.dumps(data, indent=2, default=str)
            }
        }
    }

    for attempt in range(3):
        try:
            response = _session.patch(url, json=payload)

            if response.status_code == 200:
                return True
            elif response.status_code == 404:
                print(f"❌ Gist not found: {config.GIST_ID}")
                return False
            elif response.status_code == 401:
                print("❌ GitHub authentication failed for Gist update.")
                return False
            else:
                print(f"⚠️  Gist write error {response.status_code}: {response.text[:200]}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return False

        except requests.RequestException as e:
            print(f"⚠️  Gist write request error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)

    return False


def _get_default(filename: str) -> dict:
    """Return the default structure for a given filename."""
    if filename == "queue.json":
        return _default_queue()
    elif filename == "state.json":
        return _default_state()
    return {}


# =============================================================================
# High-level queue operations
# =============================================================================

def get_queue() -> dict:
    """Read the reply queue from Gist."""
    return read_gist("queue.json")


def get_state() -> dict:
    """Read the bot state from Gist."""
    return read_gist("state.json")

def save_all(state: dict, queue: dict) -> bool:
    """Write both state and queue to Gist in a single API call to avoid rate limits."""
    from datetime import datetime, timezone
    
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    state["run_count"] = state.get("run_count", 0) + 1
    queue["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    url = f"{GIST_API_BASE}/gists/{config.GIST_ID}"
    payload = {
        "files": {
            "state.json": {"content": json.dumps(state, indent=2, default=str)},
            "queue.json": {"content": json.dumps(queue, indent=2, default=str)}
        }
    }
    
    for attempt in range(3):
        try:
            response = _session.patch(url, json=payload)
            if response.status_code == 200:
                return True
            else:
                print(f"⚠️  Gist write error {response.status_code}: {response.text[:200]}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
        except requests.RequestException as e:
            print(f"⚠️  Gist write request error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
    return False


def add_pending_reply(queue: dict, item: dict) -> dict:
    """Add a new pending reply suggestion to the queue."""
    queue.setdefault("pending", []).append(item)
    return queue


def get_approved_replies(queue: dict) -> list[dict]:
    """Get all approved replies ready to send."""
    return queue.get("approved", [])


def mark_as_sent(queue: dict, item_id: str, channel_id: str) -> dict:
    """Move an approved item to the sent list."""
    from datetime import datetime, timezone
    
    approved = queue.get("approved", [])
    sent_item = None

    for item in approved:
        if item.get("id") == item_id:
            sent_item = item
            break

    if sent_item:
        approved.remove(sent_item)
        sent_item["sent_at"] = datetime.now(timezone.utc).isoformat()
        queue.setdefault("sent", []).append(sent_item)

        # Keep only last 50 sent items to prevent Gist from growing too large
        if len(queue["sent"]) > 50:
            queue["sent"] = queue["sent"][-50:]

    return queue


def expire_old_suggestions(queue: dict) -> dict:
    """Remove pending suggestions older than SUGGESTION_EXPIRY_HOURS."""
    if config.SUGGESTION_EXPIRY_HOURS <= 0:
        return queue  # Expiry disabled

    from datetime import datetime, timezone, timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=config.SUGGESTION_EXPIRY_HOURS)
    pending = queue.get("pending", [])
    expired = []
    remaining = []

    for item in pending:
        created = item.get("created_at", "")
        try:
            item_time = datetime.fromisoformat(created)
            if item_time < cutoff:
                expired.append(item)
            else:
                remaining.append(item)
        except (ValueError, TypeError):
            remaining.append(item)  # Keep items with invalid timestamps

    if expired:
        print(f"🗑️  Expired {len(expired)} old suggestions")
        queue["pending"] = remaining

        # Move expired to skipped
        for item in expired:
            item["status"] = "expired"
            item["skipped_reason"] = "auto_expired"
        queue.setdefault("skipped", []).extend(expired)

        # Keep only last 50 skipped items
        if len(queue["skipped"]) > 50:
            queue["skipped"] = queue["skipped"][-50:]

    return queue
