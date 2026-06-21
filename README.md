# Discord DM Auto-Responder

An automated, serverless pipeline that monitors your Discord Direct Messages, generates AI-powered suggested replies that mimic your conversational style, and allows you to review, edit, skip, or send these replies via a mobile app.

The backend runs entirely on GitHub Actions on a 5-minute schedule, with state and message queues synced via a private GitHub Gist. Zero local processes required.

## Architecture

1. **GitHub Actions (`main.py`)**: Runs every 5 minutes.
   - Fetches recent DMs using your Discord user token.
   - Analyzes conversation history and generates context-aware, style-matched replies using any OpenAI-compatible API (e.g., OpenRouter, local Ollama).
   - Syncs pending suggestions to `queue.json` in a private GitHub Gist.
   - Reads approved/edited replies from the Gist and sends them back to Discord with a natural human delay.
2. **GitHub Gist**: Acts as the shared database/queue between the Actions backend and the mobile app.
3. **Mobile App (Expo React Native)**: Polling interface to review pending replies. Swipe or tap to approve, edit, or skip.

## ⚠️ Important Warning: Self-Botting
Reading your personal DMs requires using your Discord **user token**. This is considered "self-botting" and is a violation of Discord's Terms of Service. It carries a risk of account suspension or banning. Use this project entirely at your own risk.

## Setup Instructions

### 1. Create a GitHub Gist (The Database)
1. Go to [gist.github.com](https://gist.github.com/).
2. Create a new secret gist.
3. Add a file named `queue.json` with the following content: `{}`
4. Add another file named `state.json` with the following content: `{}`
5. Create the gist. Note the **Gist ID** from the URL (e.g., `gist.github.com/yourusername/THIS_IS_THE_GIST_ID`).
6. Go to GitHub Settings -> Developer Settings -> Personal Access Tokens (Tokens (classic)).
7. Generate a new token with the **`gist`** scope. Save this **GitHub PAT**.

### 2. Configure GitHub Actions (The Backend)
1. Fork or clone this repository to your own GitHub account (can be public or private).
2. Go to your repository's **Settings -> Secrets and variables -> Actions**.
3. Add the following **Repository Secrets**:
   - `DISCORD_TOKEN`: Your Discord user token.
   - `BOT_TOKEN`: (Optional) Your Discord bot token if you want bot-based notifications later.
   - `NOTIFY_USER_ID`: Your Discord User ID.
   - `OLLAMA_API_KEY`: Your API key for your AI provider (e.g., OpenRouter).
   - `GIST_ID`: The ID of the gist you created.
   - `GH_PAT`: The GitHub Personal Access Token with gist scope.
4. Optional Configuration Variables (can also be added as secrets):
   - `AI_BASE_URL`: Base URL for the AI API (default: `https://openrouter.ai/api/v1`).
   - `AI_MODEL`: Model to use (default: `meta-llama/llama-3.1-8b-instruct`).
   - `AI_TEMPERATURE`: Generation temperature (default: `0.8`).
   - `AUTO_REPLY_DELAY_MIN` & `AUTO_REPLY_DELAY_MAX`: Delay range in seconds before sending a message (default 30-120).
   - `WHITELIST_USER_IDS` & `BLACKLIST_USER_IDS`: Comma-separated Discord IDs to filter DMs.

Once secrets are added, the GitHub Action (`dm-responder.yml`) will run automatically every 5 minutes.

### 3. Run the Mobile App (The Frontend)
The mobile app is built with Expo. You can run it on your physical device via the Expo Go app.

1. Ensure you have Node.js installed.
2. Navigate to the `mobile` directory:
   ```bash
   cd mobile
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```
4. Scan the QR code with your phone (Camera app on iOS, Expo Go app on Android).
5. In the app, navigate to the **Settings** tab and enter your **Gist ID** and **GitHub PAT** to connect it to your backend.

## Local Testing
If you want to run the python backend locally instead of GitHub Actions:
1. Copy `.env.template` to `.env` and fill in your values.
2. Run `pip install -r requirements.txt`.
3. Run `python main.py`.

## License
MIT
