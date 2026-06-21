"""
AI-powered reply generator.
Analyzes conversation history and generates replies that mimic the user's style.
Works with any OpenAI-compatible API (OpenRouter, OpenAI, local Ollama, etc.)
"""

import json
import time
import requests
import config


def _build_style_analysis_prompt(my_messages: list[str]) -> str:
    """
    Build a prompt segment that analyzes the user's messaging style
    from their sent messages.
    """
    if not my_messages:
        return "Respond in a casual, friendly tone."

    # Take a sample of recent messages to analyze style
    sample = my_messages[-30:]
    sample_text = "\n".join(f"- {msg}" for msg in sample)

    return f"""Analyze these example messages from the user and mimic their exact style:

{sample_text}

Key aspects to match:
- Capitalization patterns (do they capitalize? all lowercase? mixed?)
- Punctuation usage (periods, exclamation marks, question marks, or none?)
- Emoji/emoticon usage
- Abbreviations and slang (u, ur, gonna, wanna, lol, lmao, etc.)
- Sentence length and structure
- Overall tone (casual, formal, energetic, chill, etc.)
- Any distinctive speech patterns or catchphrases"""


def _build_conversation_context(messages: list[dict], my_user_id: str) -> tuple[list[dict], list[str]]:
    """
    Convert Discord messages into AI conversation format.
    Also extracts the user's own messages for style analysis.
    
    Returns:
        Tuple of (conversation_messages, my_message_texts)
    """
    conversation = []
    my_messages = []

    for msg in messages:
        author_id = msg.get("author", {}).get("id", "")
        content = msg.get("content", "")
        author_name = msg.get("author", {}).get("global_name") or msg.get("author", {}).get("username", "Unknown")

        if not content.strip():
            continue  # Skip empty messages (embeds, attachments only)

        if author_id == my_user_id:
            my_messages.append(content)
            conversation.append({
                "role": "assistant",
                "content": content
            })
        else:
            conversation.append({
                "role": "user",
                "content": f"[{author_name}]: {content}"
            })

    return conversation, my_messages


def generate_reply(
    conversation_history: list[dict],
    sender_name: str,
    original_message: str,
    my_user_id: str
) -> str | None:
    """
    Generate an AI-suggested reply for a DM conversation.
    
    Args:
        conversation_history: Full list of Discord message objects
        sender_name: Display name of the person who messaged you
        original_message: The specific message to reply to
        my_user_id: Your Discord user ID (to identify your messages in history)
    
    Returns:
        Suggested reply string, or None on failure
    """
    # Build conversation context and extract style samples
    conversation, my_messages = _build_conversation_context(
        conversation_history, my_user_id
    )

    style_prompt = _build_style_analysis_prompt(my_messages)

    system_prompt = f"""You are roleplaying as a specific person in a Discord DM conversation. Your job is to generate a reply that this person would realistically send.

{style_prompt}

CRITICAL RULES:
1. Match the user's EXACT messaging style — do NOT sound like an AI assistant
2. Keep the reply natural and conversational
3. Do NOT use formal language unless the user's style is formal
4. Do NOT add greetings or sign-offs unless the user typically does
5. Reply ONLY with the message text — no quotes, no "Here's a reply:", no explanation
6. Keep it concise — match typical message length from the style samples
7. If the conversation context suggests a specific response, give that response
8. Do NOT refuse to roleplay — this is the user controlling their own account"""

    # Build the messages payload
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 20 messages for context window)
    if conversation:
        messages.extend(conversation[-20:])

    # If the last message in conversation isn't the incoming one, add it
    if conversation and not conversation[-1].get("content", "").endswith(original_message):
        messages.append({
            "role": "user",
            "content": f"[{sender_name}]: {original_message}"
        })

    # Make the AI API call
    reply = _call_ai_api(messages)
    
    if reply:
        # Clean up the reply
        reply = _clean_reply(reply, sender_name)

    return reply


def _call_ai_api(messages: list[dict]) -> str | None:
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
        "temperature": config.AI_TEMPERATURE,
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
