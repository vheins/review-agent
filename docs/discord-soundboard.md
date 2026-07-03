# Discord Soundboard Setup

## Prerequisites
- Discord Bot Token (from Discord Developer Portal)
- Bot invited to your server with `Connect`, `Speak`, and `Use Voice Activity` permissions
- Voice channel in your server

## Configuration

Add to your `.env`:

```env
DISCORD_BOT_ENABLED=true
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_VOICE_CHANNEL_ID=your_voice_channel_id_here
```

### Getting each value:

**Bot Token:**
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it → **Create**
3. Tab **Bot** (left sidebar) → **Reset Token** → **Copy**
4. Enable **SERVER MEMBERS INTENT** and **VOICE STATE INTENT** under `Privileged Gateway Intents`

**Invite Bot to your server:**
1. Tab **OAuth2** → **URL Generator**
2. Scopes: check `bot`
3. Bot Permissions: check `Connect`, `Speak`, `Use Voice Activity`
4. Open the generated URL, select your server, authorize

**Guild ID:**
1. Open Discord **User Settings** → **Advanced** → Enable **Developer Mode**
2. Right-click your server name (top-left) → **Copy ID**

**Voice Channel ID:**
1. With Developer Mode ON, right-click the voice channel → **Copy ID**

## Sound Files

Default sounds are generated with `ffmpeg-static`:
- `approved.ogg` — high-pitch beep (880Hz, 0.3s)
- `rejected.ogg` — low-pitch buzz (220Hz, 0.5s)

Replace them with your own `.ogg` Opus files in `packages/backend/sounds/`.

To regenerate defaults:

```bash
cd packages/backend && node --loader ts-node/esm scripts/generate-sounds.ts
```

## How It Works

When a review is completed:

```
ReviewEngineService detects APPROVE|REQUEST_CHANGES
  → DiscordBotService.playSound(sound)
    → Joins configured voice channel
    → Plays the .ogg audio file
    → Disconnects
```

- The bot stays disabled if `DISCORD_BOT_ENABLED=false` (default).
- Run `yarn start --no-sound` or `yarn once --no-sound` to disable Discord sound playback for that process.
- Uses `@Optional()` injection — no crash if module is missing or disabled.
- If sound file is missing, logs a warning and skips gracefully.
- Voice connection is created per-play and destroyed after finish to keep resources clean.
