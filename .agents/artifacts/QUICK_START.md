# Quick Start Guide

## 🚀 First Time Setup

```bash
# Run the setup script
./setup.sh

# Or manually:
yarn install
yarn rebuild better-sqlite3
cp .env.example .env
```

## ▶️ Run the App

```bash
yarn app:dev
```

**Backend server starts automatically!** No need to run it separately.

The app will:
1. Automatically start backend server (port 3000)
2. Start the UI dev server (port 5173)
3. Launch the Electron app

## ✅ Verify It's Working

You should see:
- ✓ Database initialized successfully
- ✓ REST API and WebSocket server listening on port 3000
- Dashboard shows "Connected" for API Health and Live Stream

## ❌ Common Issues

### Native Module Error
```bash
yarn rebuild better-sqlite3
```

### Backend Not Running
```bash
yarn server
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## 📚 More Help

- `README.md` - Full documentation
- `TROUBLESHOOTING.md` - Detailed troubleshooting
- `ARCHITECTURE.md` - How it works
- `RUNNING.md` - Running options

## 🎯 Quick Commands

| Command | Description |
|---------|-------------|
| `yarn app:dev` | Run everything (recommended) |
| `yarn server` | Backend server only |
| `yarn ui:dev` | UI dev server only |
| `yarn app` | Production mode |
| `yarn once` | Review PRs once |
| `yarn start` | Continuous review mode |

## 🔧 Configuration

Edit `.env` file:
```env
DELEGATE=true              # Enable AI reviews
AI_EXECUTOR=gemini         # Choose AI: gemini, copilot, kiro, etc.
REVIEW_MODE=comment        # comment or fix
AUTO_MERGE=false           # Auto-merge approved PRs
API_PORT=3000              # Backend server port
```

## 💡 Tips

- Use `yarn app:dev` for development (hot reload enabled)
- Backend server must be running for the app to work
- Check logs in `logs/` directory if issues occur
- Run `./setup.sh` after pulling updates
