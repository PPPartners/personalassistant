# PersonalAssistant UI

Visual Electron interface for the PersonalAssistant task management system.

## Features

- 📊 **3-Column Kanban Board**: Today, Due Soon, Backlog
- 🎯 **Focus Mode**: Stay on track with visual focus display
- 📅 **Start Day Workflow**: Prioritized task selection + recurring tasks
- 🌙 **End Day Workflow**: Review and clean up unfinished tasks
- 🔄 **Live Sync**: Auto-updates when Claude Code edits markdown files
- 💾 **File-Based**: No database - just markdown files
- ⚡ **Fast & Local**: Works offline, all data stays on your machine

## Installation

```bash
cd ui
npm install
```

## Development

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server
2. Launch the Electron app
3. Open DevTools for debugging

## Build

```bash
npm run electron:build
```

Creates a distributable app in the `out/` directory.

## Architecture

```
ui/
├── electron/          # Electron main process
│   ├── main.js       # App lifecycle, file operations
│   └── preload.js    # IPC bridge (secure)
├── src/
│   ├── components/   # React components
│   ├── utils/        # Markdown parser, date utils
│   ├── App.jsx       # Main app
│   └── main.jsx      # React entry
├── package.json
└── vite.config.js
```

## How It Works

1. **Electron Main Process** reads markdown files from `../tasks/`, `../ideas/`, etc.
2. **File Watcher** (chokidar) detects changes from Claude Code
3. **React Frontend** displays tasks in a visual Kanban board
4. **User edits** write back to markdown files immediately
5. **Claude Code** can still manage files via natural language

## Tech Stack

- **Electron** - Desktop app framework
- **React** - UI library
- **Vite** - Fast build tool
- **TailwindCSS** - Styling
- **chokidar** - File watching
- **gray-matter** - Markdown parsing
- **date-fns** - Date utilities

## Color Scheme

Clean minimal with color accents:
- **Primary (Blue)**: Actions, links, targets
- **Success (Green)**: Completion, start day
- **Warning (Orange)**: Deadlines 3-7 days out
- **Danger (Red)**: Overdue tasks
- **Neutral (Gray)**: Base UI, backlog
