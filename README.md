# PersonalAssistant

A task management system with Electron UI, Claude Code integration, and auto-updates.

## Project Structure

This repository contains only the **code** for PersonalAssistant. Your personal data is stored separately:

- **Code**: `~/Development/PersonalAssistant/` (this repo)
- **Data**: `~/PersonalAssistant/` (your tasks, config, schedule, etc.)

### Data Directory Structure

```
~/PersonalAssistant/
├── tasks/           # Today, due soon, backlog, overdue
├── ideas/           # Idea inbox
├── archive/         # Completed and dropped tasks
├── config/          # Settings, daily recurring tasks, tags
├── schedule/        # Daily schedules (JSON files)
├── attachments/     # Screenshots and images
├── logs/           # Optional logs
└── CLAUDE.md       # Project instructions for Claude Code
```

## Development

```bash
cd ~/Development/PersonalAssistant/ui
npm install
npm run electron:dev
```

The app will automatically read/write data from `~/PersonalAssistant/`.

## Building

```bash
cd ui
npm run electron:build
```

## Publishing Updates

1. Update version in `ui/package.json`
2. Build and publish:
   ```bash
   cd ui
   npm run electron:build -- --publish always
   ```

See `ui/RELEASES.md` for detailed publishing instructions.

## Auto-Updates

The app uses `electron-updater` to check for updates from GitHub releases. Updates are published to:
- https://github.com/PPPartners/personalassistant/releases
