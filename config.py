"""
Configuration loader for Discord DM Auto-Responder.
Loads from environment variables (GitHub Actions secrets or .env file).
"""

import os
import sys
from dotenv import load_dotenv

# Load .env file if it exists (for local development)
load_dotenv()


def _get_required(key: str) -> str:
    """Get a required environment variable or exit with an error."""
    value = os.getenv(key)
    if not value:
        print(f"❌ Missing required environment variable: {key}")
        print(f"   Set it in .env (local) or GitHub Actions Secrets (CI).")
        sys.exit(1)
    return value


def _get_optional(key: str, default: str = "") -> str:
    """Get an optional environment variable with a default."""
    return os.getenv(key, default)


def _get_int(key: str, default: int) -> int:
    """Get an integer environment variable with a default."""
    value = os.getenv(key, str(default))
    try:
        return int(value)
    except ValueError:
        print(f"⚠️  Invalid integer for {key}: {value!r}, using default {default}")
        return default


def _get_float(key: str, default: float) -> float:
    """Get a float environment variable with a default."""
    value = os.getenv(key, str(default))
    try:
        return float(value)
    except ValueError:
        print(f"⚠️  Invalid float for {key}: {value!r}, using default {default}")
        return default


def _get_list(key: str) -> list[str]:
    """Get a comma-separated list from an environment variable."""
    value = os.getenv(key, "")
    if not value.strip():
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


# =============================================================================
# Discord
# =============================================================================
DISCORD_TOKEN = _get_required("DISCORD_TOKEN")
BOT_TOKEN = _get_optional("BOT_TOKEN")
NOTIFY_USER_ID = _get_required("NOTIFY_USER_ID")

DISCORD_API_BASE = "https://discord.com/api/v10"

# =============================================================================
# Polling & Timing
# =============================================================================
CHECK_INTERVAL = _get_int("CHECK_INTERVAL", 60)
AUTO_REPLY_DELAY_MIN = _get_int("AUTO_REPLY_DELAY_MIN", 30)
AUTO_REPLY_DELAY_MAX = _get_int("AUTO_REPLY_DELAY_MAX", 120)
MAX_HISTORY_MESSAGES = _get_int("MAX_HISTORY_MESSAGES", 100)
SUGGESTION_EXPIRY_HOURS = _get_int("SUGGESTION_EXPIRY_HOURS", 24)

# =============================================================================
# AI Configuration
# =============================================================================
OLLAMA_API_KEY = _get_required("OLLAMA_API_KEY")
AI_BASE_URL = _get_optional("AI_BASE_URL", "https://openrouter.ai/api/v1")
AI_MODEL = _get_optional("AI_MODEL", "meta-llama/llama-3.1-8b-instruct")
AI_TEMPERATURE = _get_float("AI_TEMPERATURE", 0.8)
AI_MAX_TOKENS = _get_int("AI_MAX_TOKENS", 256)

# =============================================================================
# GitHub Gist Storage
# =============================================================================
GIST_ID = _get_required("GIST_ID")
GH_PAT = _get_required("GH_PAT")

# =============================================================================
# Contact Filtering
# =============================================================================
WHITELIST_USER_IDS = _get_list("WHITELIST_USER_IDS")
BLACKLIST_USER_IDS = _get_list("BLACKLIST_USER_IDS")


def print_config_summary():
    """Print a sanitized config summary for debugging."""
    print("=" * 60)
    print("📋 Configuration Summary")
    print("=" * 60)
    print(f"  Discord User ID:     {NOTIFY_USER_ID}")
    print(f"  Discord Token:       {'✅ Set' if DISCORD_TOKEN else '❌ Missing'}")
    print(f"  Bot Token:           {'✅ Set' if BOT_TOKEN else '⏭️  Not set'}")
    print(f"  AI Base URL:         {AI_BASE_URL}")
    print(f"  AI Model:            {AI_MODEL}")
    print(f"  AI Temperature:      {AI_TEMPERATURE}")
    print(f"  Gist ID:             {GIST_ID[:8]}...")
    print(f"  GH PAT:              {'✅ Set' if GH_PAT else '❌ Missing'}")
    print(f"  History Messages:    {MAX_HISTORY_MESSAGES}")
    print(f"  Reply Delay:         {AUTO_REPLY_DELAY_MIN}-{AUTO_REPLY_DELAY_MAX}s")
    print(f"  Suggestion Expiry:   {SUGGESTION_EXPIRY_HOURS}h")
    print(f"  Whitelist:           {WHITELIST_USER_IDS or 'All DMs'}")
    print(f"  Blacklist:           {BLACKLIST_USER_IDS or 'None'}")
    print("=" * 60)
