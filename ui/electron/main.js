import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import chokidar from 'chokidar';
import os from 'os';
import pty from 'node-pty';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to PersonalAssistant root
// In production, use fixed path in user's home directory
// In development, use relative path
const PA_ROOT = app.isPackaged
  ? path.join(os.homedir(), 'PersonalAssistant')
  : path.join(__dirname, '..', '..');

let mainWindow;
let fileWatcher;
let ptyProcess;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117'
  });

  console.log('Preload path:', path.join(__dirname, 'preload.cjs'));
  console.log('PA_ROOT:', PA_ROOT);

  // Load the app
  if (app.isPackaged) {
    // Production: load from dist folder
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    // Development: load from vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  // Set up file watcher for markdown files
  setupFileWatcher();

  // Check for updates after window is ready (only in production)
  if (app.isPackaged) {
    setTimeout(() => {
      checkForUpdates();
    }, 3000); // Wait 3 seconds after launch
  }
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available');
});

autoUpdater.on('error', (err) => {
  console.error('Update error:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

function checkForUpdates() {
  autoUpdater.checkForUpdates().catch(err => {
    console.error('Failed to check for updates:', err);
  });
}

function setupFileWatcher() {
  const pathsToWatch = [
    path.join(PA_ROOT, 'tasks', '*.md'),
    path.join(PA_ROOT, 'ideas', '*.md'),
    path.join(PA_ROOT, 'archive', '*.md'),
    path.join(PA_ROOT, 'config', '*.md'),
    path.join(PA_ROOT, 'config', '*.json'),
    path.join(PA_ROOT, 'schedule', '*.json')
  ];

  fileWatcher = chokidar.watch(pathsToWatch, {
    persistent: true,
    ignoreInitial: true
  });

  fileWatcher.on('change', (filePath) => {
    if (mainWindow) {
      mainWindow.webContents.send('file-changed', filePath);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (fileWatcher) {
    fileWatcher.close();
  }
  if (ptyProcess) {
    ptyProcess.kill();
    ptyProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers for file operations
ipcMain.handle('read-file', async (event, relativePath) => {
  try {
    const fullPath = path.join(PA_ROOT, relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, relativePath, content) => {
  try {
    const fullPath = path.join(PA_ROOT, relativePath);
    await fs.writeFile(fullPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-all-tasks', async () => {
  try {
    console.log('Reading tasks from:', PA_ROOT);
    const [today, dueSoon, backlog, overdue, settings, recurring] = await Promise.all([
      fs.readFile(path.join(PA_ROOT, 'tasks', 'today.md'), 'utf-8'),
      fs.readFile(path.join(PA_ROOT, 'tasks', 'due_soon.md'), 'utf-8'),
      fs.readFile(path.join(PA_ROOT, 'tasks', 'backlog.md'), 'utf-8'),
      fs.readFile(path.join(PA_ROOT, 'tasks', 'overdue.md'), 'utf-8').catch(() => ''),
      fs.readFile(path.join(PA_ROOT, 'config', 'settings.json'), 'utf-8'),
      fs.readFile(path.join(PA_ROOT, 'config', 'daily_recurring.md'), 'utf-8')
    ]);

    console.log('Successfully read all task files');
    return {
      success: true,
      data: {
        today,
        dueSoon,
        backlog,
        overdue,
        settings: JSON.parse(settings),
        recurring
      }
    };
  } catch (error) {
    console.error('Error reading tasks:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-ideas', async () => {
  try {
    const content = await fs.readFile(path.join(PA_ROOT, 'ideas', 'inbox.md'), 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-archive', async () => {
  try {
    const [done, dropped] = await Promise.all([
      fs.readFile(path.join(PA_ROOT, 'archive', 'done.md'), 'utf-8'),
      fs.readFile(path.join(PA_ROOT, 'archive', 'dropped.md'), 'utf-8')
    ]);

    return {
      success: true,
      data: { done, dropped }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Schedule IPC Handlers
ipcMain.handle('read-schedule', async (event, date) => {
  try {
    const filePath = path.join(PA_ROOT, 'schedule', `${date}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const schedule = JSON.parse(content);
    return { success: true, schedule };
  } catch (error) {
    // If file doesn't exist, return empty schedule
    if (error.code === 'ENOENT') {
      return {
        success: true,
        schedule: {
          date,
          meetings: [],
          scheduledTasks: []
        }
      };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-schedule', async (event, date, schedule) => {
  try {
    const filePath = path.join(PA_ROOT, 'schedule', `${date}.json`);
    await fs.writeFile(filePath, JSON.stringify(schedule, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-pa-root', () => {
  return PA_ROOT;
});

// Terminal/PTY handlers
ipcMain.handle('start-terminal', () => {
  try {
    // If PTY already exists, don't start another one
    if (ptyProcess) {
      console.log('Terminal already running, skipping start');
      return { success: true, alreadyRunning: true };
    }

    // Use a login shell to load user's environment
    const shell = process.env.SHELL || '/bin/zsh';
    console.log('Starting terminal with shell:', shell, 'in directory:', PA_ROOT);

    // Spawn the PTY process as a login shell to load .zshrc/.bashrc
    ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: PA_ROOT,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    // Send data from PTY to renderer
    ptyProcess.onData((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('terminal-data', data);
      }
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log('PTY process exited', { exitCode, signal });
      ptyProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('terminal-exit', { exitCode, signal });
      }
    });

    // Auto-run claude command and send startup instruction
    setTimeout(() => {
      if (ptyProcess) {
        ptyProcess.write('claude\r');
      }
    }, 500);

    // Send startup instruction after Claude Code is ready
    setTimeout(() => {
      if (ptyProcess) {
        // Type the message
        ptyProcess.write('Please read .claude/startup_instruction.md and follow the instructions there to get started with full context.');
        // Try Cmd+Enter (Ctrl key = \x03, but on Mac Cmd doesn't translate to PTY)
        // Let's try Tab then Enter to submit
        setTimeout(() => {
          if (ptyProcess) {
            // Try sending Ctrl+D then Enter, or just multiple enters
            ptyProcess.write('\r\n');
          }
        }, 300);
      }
    }, 6000);

    return { success: true };
  } catch (error) {
    console.error('Failed to start terminal:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-write', (event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
    return { success: true };
  }
  return { success: false, error: 'No terminal process' };
});

ipcMain.handle('terminal-resize', (event, cols, rows) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
    return { success: true };
  }
  return { success: false };
});

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', async () => {
  try {
    if (!app.isPackaged) {
      return { success: false, error: 'Updates only available in production' };
    }
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result.updateInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});
