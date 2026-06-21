"""
Discord DM Auto-Responder — Main Pipeline
==========================================
Entry point for GitHub Actions. Orchestrates the full pipeline:

1. Check Discord DMs for new messages
2. Generate AI-suggested replies for unread messages
3. Sync suggestions to GitHub Gist (for mobile app review)
4. Send approved replies back to Discord
5. Clean up expired suggestions
"""

import sys
import time
import uuid
import random
from datetime import datetime, timezone

import config
import discord_client
import gist_store
import ai_responder


def step_1_check_new_messages(state: dict) -> list[dict]:
    """
    Check all DM channels for new messages since last run.
    
    Returns:
        List of new message items with channel + sender context
    """
    print("\n" + "=" * 60)
    print("📥 Step 1: Checking for new DM messages...")
    print("=" * 60)

    new_items = []
    channels = discord_client.get_dm_channels()

    if not channels:
        print("   No DM channels found.")
        return new_items

    last_checked = state.get("last_checked", {})
    processed_ids = set(state.get("processed_message_ids", []))

    for channel in channels:
        channel_id = channel["id"]
        recipient = discord_client.get_channel_recipient(channel)

        if not recipient:
            continue

        sender_name = recipient.get("global_name") or recipient.get("username", "Unknown")
        sender_id = recipient.get("id", "")

        # Get messages after the last-checked message ID for this channel
        after_id = last_checked.get(channel_id)
        messages = discord_client.get_messages(channel_id, after=after_id, limit=50)

        if not messages:
            continue

        # Filter to only messages FROM the other person (not our own)
        incoming = [
            msg for msg in messages
            if msg.get("author", {}).get("id") != config.NOTIFY_USER_ID
            and msg.get("id") not in processed_ids
            and msg.get("content", "").strip()  # Skip empty messages
        ]

        if incoming:
            print(f"   💬 {sender_name}: {len(incoming)} new message(s)")

            for msg in incoming:
                new_items.append({
                    "channel_id": channel_id,
                    "message_id": msg["id"],
                    "sender_name": sender_name,
                    "sender_id": sender_id,
                    "sender_avatar": discord_client.format_avatar_url(recipient),
                    "content": msg.get("content", ""),
                    "timestamp": msg.get("timestamp", ""),
                })

        # Update the last-checked pointer for this channel
        if messages:
            last_checked[channel_id] = messages[-1]["id"]

        time.sleep(0.3)  # Small delay between channel checks

    # Update state
    state["last_checked"] = last_checked

    # Add new message IDs to processed set (keep last 500)
    for item in new_items:
        processed_ids.add(item["message_id"])
    state["processed_message_ids"] = list(processed_ids)[-500:]

    print(f"\n   📊 Total new messages: {len(new_items)}")
    return new_items


def step_2_generate_suggestions(new_items: list[dict], queue: dict) -> dict:
    """
    Generate AI-suggested replies for new messages.
    
    Args:
        new_items: New messages from Step 1
        queue: Current queue state
    
    Returns:
        Updated queue with new pending suggestions
    """
    print("\n" + "=" * 60)
    print("🤖 Step 2: Generating AI reply suggestions...")
    print("=" * 60)

    if not new_items:
        print("   No new messages to process.")
        return queue

    # Group messages by channel to avoid duplicate suggestions
    channel_messages: dict[str, list[dict]] = {}
    for item in new_items:
        ch_id = item["channel_id"]
        channel_messages.setdefault(ch_id, []).append(item)

    for channel_id, items in channel_messages.items():
        # Use the latest message as the one to reply to
        latest = items[-1]
        sender_name = latest["sender_name"]

        print(f"\n   🔄 Generating reply for {sender_name}...")
        print(f"      Message: {latest['content'][:80]}{'...' if len(latest['content']) > 80 else ''}")

        # Check if we already have a pending suggestion for this channel
        existing = [
            p for p in queue.get("pending", [])
            if p.get("channel_id") == channel_id and p.get("status") == "pending"
        ]
        if existing:
            print(f"      ⏭️  Already have a pending suggestion for this channel. Skipping.")
            continue

        # Get conversation history for context
        history = discord_client.get_conversation_history(channel_id, limit=50)

        # Generate AI reply
        suggested_reply = ai_responder.generate_reply(
            conversation_history=history,
            sender_name=sender_name,
            original_message=latest["content"],
            my_user_id=config.NOTIFY_USER_ID
        )

        if suggested_reply:
            # Build the context summary (last few messages for mobile display)
            context = []
            for msg in history[-5:]:
                author = msg.get("author", {})
                name = author.get("global_name") or author.get("username", "?")
                context.append(f"{name}: {msg.get('content', '')[:100]}")

            suggestion = {
                "id": str(uuid.uuid4()),
                "channel_id": channel_id,
                "sender_name": sender_name,
                "sender_id": latest["sender_id"],
                "sender_avatar": latest["sender_avatar"],
                "original_message": latest["content"],
                "conversation_context": context,
                "suggested_reply": suggested_reply,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            queue = gist_store.add_pending_reply(queue, suggestion)
            print(f"      ✅ Suggestion: {suggested_reply[:80]}{'...' if len(suggested_reply) > 80 else ''}")
        else:
            print(f"      ❌ Failed to generate reply for {sender_name}")

        time.sleep(1)  # Pace AI API calls

    return queue


def step_3_send_approved(queue: dict) -> dict:
    """
    Send all approved replies back to Discord.
    
    Args:
        queue: Current queue state
    
    Returns:
        Updated queue with sent items moved
    """
    print("\n" + "=" * 60)
    print("📤 Step 3: Sending approved replies...")
    print("=" * 60)

    approved = gist_store.get_approved_replies(queue)

    if not approved:
        print("   No approved replies to send.")
        return queue

    print(f"   Found {len(approved)} approved reply(ies)")

    for item in approved[:]:  # Copy list since we're modifying it
        channel_id = item.get("channel_id")
        reply_text = item.get("final_reply") or item.get("suggested_reply", "")
        item_id = item.get("id")

        if not reply_text or not channel_id:
            print(f"   ⚠️  Invalid approved item: {item_id}")
            continue

        # Add a random human-like delay
        delay = random.randint(config.AUTO_REPLY_DELAY_MIN, config.AUTO_REPLY_DELAY_MAX)
        
        # In GitHub Actions, we don't want long waits. Cap at 10 seconds.
        actual_delay = min(delay, 10)
        print(f"   ⏳ Waiting {actual_delay}s before sending (natural delay)...")
        time.sleep(actual_delay)

        # Send the message
        result = discord_client.send_message(channel_id, reply_text)

        if result:
            queue = gist_store.mark_as_sent(queue, item_id, channel_id)
            sender = item.get("sender_name", "Unknown")
            print(f"   ✅ Sent reply to {sender}: {reply_text[:60]}...")
        else:
            print(f"   ❌ Failed to send reply {item_id}")

    return queue


def step_4_cleanup(queue: dict) -> dict:
    """
    Clean up expired suggestions and trim history.
    """
    print("\n" + "=" * 60)
    print("🧹 Step 4: Cleaning up...")
    print("=" * 60)

    queue = gist_store.expire_old_suggestions(queue)

    # Print queue summary
    pending = len(queue.get("pending", []))
    approved = len(queue.get("approved", []))
    sent = len(queue.get("sent", []))
    skipped = len(queue.get("skipped", []))

    print(f"   📊 Queue: {pending} pending, {approved} approved, {sent} sent, {skipped} skipped")
    return queue


def run_pipeline():
    """Execute the full pipeline."""
    start = time.time()
    print("🚀 Discord DM Auto-Responder Pipeline Starting...")
    print(f"   Time: {datetime.now(timezone.utc).isoformat()}")
    config.print_config_summary()

    # Verify Discord connection
    user_info = discord_client.get_user_info()
    if not user_info:
        print("❌ Cannot connect to Discord. Aborting.")
        sys.exit(1)

    username = user_info.get("global_name") or user_info.get("username", "Unknown")
    print(f"\n✅ Connected to Discord as: {username} ({user_info.get('id')})")

    # Load state and queue from Gist
    state = gist_store.get_state()
    queue = gist_store.get_queue()

    try:
        # Step 1: Check for new messages
        new_items = step_1_check_new_messages(state)

        # Step 2: Generate AI suggestions for new messages
        queue = step_2_generate_suggestions(new_items, queue)

        # Step 3: Send any approved replies
        queue = step_3_send_approved(queue)

        # Step 4: Clean up expired suggestions
        queue = step_4_cleanup(queue)

    except Exception as e:
        print(f"\n❌ Pipeline error: {e}")
        import traceback
        traceback.print_exc()
        # Still try to save state even on error

    # Save state and queue back to Gist
    print("\n" + "=" * 60)
    print("💾 Saving state and queue to Gist...")
    print("=" * 60)

    if gist_store.save_state(state):
        print("   ✅ State saved")
    else:
        print("   ❌ Failed to save state")

    if gist_store.save_queue(queue):
        print("   ✅ Queue saved")
    else:
        print("   ❌ Failed to save queue")

    elapsed = time.time() - start
    print(f"\n🏁 Pipeline complete in {elapsed:.1f}s")


if __name__ == "__main__":
    # Run for 5 hours and 50 minutes total to stay safely under GitHub Actions 6 hour limit
    MAX_RUN_TIME_SECONDS = (5 * 3600) + (50 * 60)
    LOOP_INTERVAL_SECONDS = int(config.CHECK_INTERVAL) if hasattr(config, 'CHECK_INTERVAL') else 300
    
    start_time = time.time()
    print(f"🔄 Starting continuous 6-hour runner. Will loop every {LOOP_INTERVAL_SECONDS/60:.1f} minutes.")
    
    iteration = 1
    while True:
        elapsed = time.time() - start_time
        if elapsed >= MAX_RUN_TIME_SECONDS:
            print(f"\n⏳ Reached maximum execution time ({elapsed/60:.1f} minutes). Shutting down gracefully.")
            break
            
        print("\n" + "="*80)
        print(f"▶️ RUNNING ITERATION {iteration} (Elapsed: {elapsed/60:.1f}m / {MAX_RUN_TIME_SECONDS/60:.1f}m limit)")
        print("="*80)
        
        try:
            run_pipeline()
        except Exception as e:
            print(f"❌ Error in iteration {iteration}: {e}")
        
        iteration += 1
        
        # Calculate how long to sleep
        time_left_in_job = MAX_RUN_TIME_SECONDS - (time.time() - start_time)
        sleep_time = min(LOOP_INTERVAL_SECONDS, time_left_in_job)
        
        if sleep_time > 0:
            print(f"\n💤 Sleeping for {sleep_time/60:.1f} minutes until next check...")
            time.sleep(sleep_time)
