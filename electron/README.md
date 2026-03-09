# PR Review Agent - Desktop App

Modern desktop application for automated GitHub Pull Request reviews powered by Gemini AI.

## Features

- 🎨 **Modern UI** - Beautiful dark-themed interface
- 📊 **Dashboard** - Real-time stats and activity monitoring
- ⚙️ **Configuration** - Easy-to-use settings panel
- 📝 **Live Logs** - Monitor review process in real-time
- 🔔 **Notifications** - Desktop notifications for important events
- 🚀 **One-Click Start** - Start/stop reviews with a single click

## Running the App

### Development Mode
```bash
yarn app:dev
```

### Production Mode
```bash
yarn app
```

## Building the App

### Build for all platforms
```bash
yarn build
```

### Build for specific platform
```bash
yarn build:win    # Windows
yarn build:mac    # macOS
yarn build:linux  # Linux
```

## Screenshots

### Dashboard
- Control panel with start/stop buttons
- Real-time statistics (Total PRs, Approved, Changes Requested, Manual Merge)
- Recent activity feed

### Configuration
- Enable/disable delegation
- Review mode (Comment/Fix)
- Review interval
- Auto-merge settings
- Gemini YOLO mode
- PR scope configuration
- Log level

### Logs
- Live log streaming
- Color-coded log levels
- Auto-scroll
- Clear logs button

## Tech Stack

- **Electron** - Desktop app framework
- **Node.js** - Backend runtime
- **HTML/CSS/JS** - Frontend
- **IPC** - Inter-process communication

## Architecture

```
electron/
├── main.js       # Main process (Node.js)
├── preload.js    # Preload script (bridge)
├── renderer.js   # Renderer process (UI logic)
├── index.html    # UI structure
└── styles.css    # UI styling
```

## Configuration

The app reads configuration from `.env` file in the root directory. You can edit settings through the UI or manually edit the `.env` file.

## Notes

- The app runs the CLI review agent in the background
- All CLI features are available through the UI
- Logs are displayed in real-time
- Desktop notifications work on all platforms
