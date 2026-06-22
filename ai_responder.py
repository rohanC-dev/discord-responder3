"""
AI-powered reply generator.
Analyzes conversation history and generates replies that mimic the user's style.
Works with any OpenAI-compatible API (OpenRouter, OpenAI, local Ollama, etc.)
"""

import json
import time
import re
import requests
import config

# Regex to match Unicode emojis (covers most common ranges)
_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U00002702-\U000027B0"  # dingbats
    "\U000024C2-\U0001F251"  # misc
    "\U0001F900-\U0001F9FF"  # supplemental
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols extended
    "\U00002600-\U000026FF"  # misc symbols
    "\U0000FE00-\U0000FE0F"  # variation selectors
    "\U0000200D"             # zero width joiner
    "\U00002764"             # heart
    "]+",
    flags=re.UNICODE,
)

def _strip_emoji(text: str) -> str:
    """Remove Unicode emojis from text, preserving Discord custom emotes."""
    return _EMOJI_RE.sub("", text).strip()


STYLE_SYSTEM_PROMPT = """\
You are a writing-style analyst. Given a conversation between two people, \
analyze the TARGET USER's writing style in detail.

Focus on:
- Average message length (short/medium/long)
- Capitalization habits (all lowercase, normal, ALL CAPS, etc.)
- Punctuation style (no punctuation, normal, excessive !!! or ???)
- Emoji/emoticon usage (which ones, how often)
- Slang, abbreviations, internet speak (lol, lmao, ngl, fr, etc.)
- Tone (casual, formal, playful, sarcastic, dry, etc.)
- Common phrases or filler words they repeat
- How they start/end messages
- Whether they use multiple short messages or one long message
- Response patterns (do they ask questions back? react to things?)

Return a concise style profile as bullet points. This will be used to \
generate responses that sound exactly like them.
"""


def analyze_style(messages: list[dict], my_user_id: str) -> str:
    """Analyze the user's writing style from conversation messages."""
    lines: list[str] = []
    for msg in messages:
        author_id = msg.get("author", {}).get("id", "")
        author_name = msg.get("author", {}).get("global_name") or msg.get("author", {}).get("username", "Unknown")
        content = msg.get("content", "")
        if not content.strip():
            continue
            
        label = "TARGET USER" if author_id == my_user_id else author_name
        lines.append(f"[{label}]: {content}")

    if not lines:
        return "No text messages found to analyze style."

    conversation_text = "\n".join(lines)
    
    messages_payload = [
        {"role": "system", "content": STYLE_SYSTEM_PROMPT},
        {"role": "user", "content": f"Analyze TARGET USER's writing style:\n\n{conversation_text}"},
    ]
    
    return _call_ai_api(messages_payload, temperature=0.3) or "Respond casually."


RESPONSE_SYSTEM_PROMPT = """\
You are ghostwriting a Discord DM reply for someone. You must sound EXACTLY \
like them — matching their style, tone, slang, emoji usage, capitalization, \
punctuation, and message length perfectly.

Rules:
- You are replying AS the target user in a casual Discord DM conversation.
- Match the style profile EXACTLY. If they type in all lowercase with no \
  punctuation, you do the same. If they use lots of emojis, you do too.
- Keep the reply natural and contextually relevant to the conversation.
- Don't be generic or robotic. Be specific to what was said.
- Keep the conversation going — be engaging and entertaining.
- NEVER mention that you are an AI, a bot, or that you were generated.
- NEVER use phrases like "as an AI" or "I'm here to help".
- If sending multiple messages, put each message on its OWN LINE separated \
  by a newline. Each line = one separate Discord message.
- If including a GIF/tenor URL, put it on its own separate line.
- Keep it to 1-3 short messages (1-3 lines).
- NEVER use standard Unicode emojis (😊❤️😂🥺 etc). Only use Discord \
  custom emotes like :kissess: or <a:name:id> format. Unicode emojis \
  look robotic.
- If the conversation seems to be dying, bring up something interesting or \
  ask an engaging question based on past conversation topics.
"""


def generate_reply(
    conversation_history: list[dict],
    sender_name: str,
    original_message: str,
    my_user_id: str,
    style_profile: str
) -> str | None:
    """
    Generate an AI-suggested reply matching the extracted style profile.
    """
    lines: list[str] = []
    for msg in conversation_history:
        author_id = msg.get("author", {}).get("id", "")
        author_name = msg.get("author", {}).get("global_name") or msg.get("author", {}).get("username", "Unknown")
        content = msg.get("content", "")
        if not content.strip():
            continue
            
        label = "ME" if author_id == my_user_id else author_name
        lines.append(f"[{label}]: {content}")

    # Make sure we include the latest message if not already there
    if not lines or not lines[-1].endswith(original_message):
        lines.append(f"[{sender_name}]: {original_message}")

    conversation_text = "\n".join(lines)
    
    prompt = (
        f"## My Writing Style Profile\n{style_profile}\n\n"
        f"## Recent Conversation\n{conversation_text}\n\n"
        f"## Task\n"
        f"Write my next reply in this conversation. The other person just "
        f"sent the last message(s) and I need to respond. Match my style "
        f"EXACTLY. Reply with ONLY the message text, nothing else."
    )

    messages_payload = [
        {"role": "system", "content": RESPONSE_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    reply = _call_ai_api(messages_payload, temperature=0.9)
    if reply:
        reply = _strip_emoji(_clean_reply(reply, sender_name))
        
    return reply


def _call_ai_api(messages: list[dict], temperature: float | None = None) -> str | None:
    """Call the AI API to generate a chat completion."""
    url = f"{config.AI_BASE_URL}/chat/completions"

    headers = {
        "Authorization": f"Bearer {config.OLLAMA_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/discord-dm-responder",
        "X-Title": "Discord DM Responder"
    }

    payload = {
        "model": config.AI_MODEL,
        "messages": messages,
        "temperature": temperature if temperature is not None else config.AI_TEMPERATURE,
        "max_tokens": config.AI_MAX_TOKENS,
        "top_p": 0.9,
    }

    for attempt in range(3):
        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "").strip()
                print("⚠️  AI returned empty choices")
                return None

            elif response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", 5))
                print(f"⏳ AI rate limited. Waiting {retry_after}s...")
                time.sleep(retry_after)
                continue

            elif response.status_code == 401:
                print("❌ AI authentication failed. Check OLLAMA_API_KEY.")
                return None

            elif response.status_code == 402:
                print("❌ AI API: Insufficient credits/quota.")
                return None

            else:
                print(f"⚠️  AI API error {response.status_code}: {response.text[:200]}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return None

        except requests.Timeout:
            print(f"⚠️  AI API timeout (attempt {attempt + 1}/3)")
            if attempt < 2:
                time.sleep(2 ** attempt)
        except requests.RequestException as e:
            print(f"⚠️  AI API request error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)

    return None


def _clean_reply(reply: str, sender_name: str) -> str:
    """Clean up AI-generated reply text."""
    # Remove common AI wrapper patterns
    reply = reply.strip()

    # Remove quotes if the AI wrapped the reply in them
    if reply.startswith('"') and reply.endswith('"'):
        reply = reply[1:-1]
    if reply.startswith("'") and reply.endswith("'"):
        reply = reply[1:-1]

    # Remove "Here's a reply:" type prefixes
    prefixes_to_remove = [
        "Here's a reply:",
        "Here is a reply:",
        "Reply:",
        "Response:",
        "Suggested reply:",
        f"[{sender_name}]:",
        f"[You]:",
        "Me:",
    ]
    for prefix in prefixes_to_remove:
        if reply.lower().startswith(prefix.lower()):
            reply = reply[len(prefix):].strip()

    return reply.strip()
