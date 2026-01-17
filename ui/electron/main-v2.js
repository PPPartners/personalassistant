import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import chokidar from 'chokidar';
import os from 'os';
import pty from 'node-pty';
import pkg from 'electron-updater';
import { AgentManagerV2 } from './agent-manager-v2.js';

const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to PersonalAssistant root (data directory)
const PA_ROOT = path.join(os.homedir(), 'PersonalAssistant');

let mainWindow;
let fileWatcher;
let ptyProcess;
let agentManager; // V2 Agent Manager

/**
 * Load Anthropic API key from settings file or environment variable
 */
function loadAnthropicApiKey() {
  // First try environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Then try settings.json
  try {
    const settingsPath = path.join(PA_ROOT, 'config', 'settings.json');
    if (fsSync.existsSync(settingsPath)) {
      const settingsContent = fsSync.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);
      if (settings.anthropic_api_key) {
        return settings.anthropic_api_key;
      }
    }
  } catch (error) {
    console.error('Failed to load API key from settings:', error);
  }

  return null;
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Initialize Agent Manager V2
  const apiKey = loadAnthropicApiKey();
  if (apiKey) {
    agentManager = new AgentManagerV2(apiKey, mainWindow);
    console.log('Agent Manager V2 initialized');
  } else {
    console.warn('ANTHROPIC_API_KEY not set - agent functionality disabled');
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// File System IPC Handlers
// ============================================================================

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
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-all-tasks', async () => {
  try {
    console.log('Reading tasks from:', PA_ROOT);
    const tasksDir = path.join(PA_ROOT, 'tasks');
    const configDir = path.join(PA_ROOT, 'config');

    const [today, dueSoon, backlog, overdue, settings, recurring] = await Promise.all([
      fs.readFile(path.join(tasksDir, 'today.md'), 'utf-8').catch(() => ''),
      fs.readFile(path.join(tasksDir, 'due_soon.md'), 'utf-8').catch(() => ''),
      fs.readFile(path.join(tasksDir, 'backlog.md'), 'utf-8').catch(() => ''),
      fs.readFile(path.join(tasksDir, 'overdue.md'), 'utf-8').catch(() => ''),
      fs.readFile(path.join(configDir, 'settings.json'), 'utf-8').then(JSON.parse).catch(() => ({})),
      fs.readFile(path.join(configDir, 'daily_recurring.md'), 'utf-8').catch(() => '')
    ]);

    console.log('Successfully read all task files');
    return {
      success: true,
      data: {
        today,
        dueSoon,
        backlog,
        overdue,
        settings,
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
    const ideasPath = path.join(PA_ROOT, 'ideas', 'inbox.md');
    const content = await fs.readFile(ideasPath, 'utf-8').catch(() => '');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-archive', async () => {
  try {
    const archiveDir = path.join(PA_ROOT, 'archive');
    const [done, dropped] = await Promise.all([
      fs.readFile(path.join(archiveDir, 'done.md'), 'utf-8').catch(() => ''),
      fs.readFile(path.join(archiveDir, 'dropped.md'), 'utf-8').catch(() => '')
    ]);
    return { success: true, done, dropped };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-schedule', async (event, date) => {
  try {
    const schedulePath = path.join(PA_ROOT, 'schedule', `${date}.json`);
    const content = await fs.readFile(schedulePath, 'utf-8');
    return { success: true, schedule: JSON.parse(content) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true, schedule: { date, meetings: [], scheduledTasks: [] } };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-schedule', async (event, date, schedule) => {
  try {
    const schedulePath = path.join(PA_ROOT, 'schedule', `${date}.json`);
    await fs.mkdir(path.dirname(schedulePath), { recursive: true });
    await fs.writeFile(schedulePath, JSON.stringify(schedule, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-pa-root', () => {
  return PA_ROOT;
});

// ============================================================================
// Attachment IPC Handlers
// ============================================================================

ipcMain.handle('attach-file-to-task', async (event, { taskId, sourcePath, filename }) => {
  try {
    const attachmentDir = path.join(PA_ROOT, 'attachments', taskId);
    await fs.mkdir(attachmentDir, { recursive: true });

    const destPath = path.join(attachmentDir, filename);
    await fs.copyFile(sourcePath, destPath);

    return { success: true, filename };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-task-attachments', async (event, taskId) => {
  try {
    const attachmentDir = path.join(PA_ROOT, 'attachments', taskId);

    // Check if directory exists
    try {
      await fs.access(attachmentDir);
    } catch {
      return { success: true, attachments: [] };
    }

    const files = await fs.readdir(attachmentDir);
    const attachments = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(attachmentDir, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          modified: stats.mtime,
          path: filePath
        };
      })
    );

    return { success: true, attachments };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-attachment', async (event, { taskId, filename }) => {
  try {
    const { shell } = await import('electron');
    const filePath = path.join(PA_ROOT, 'attachments', taskId, filename);
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-attachment', async (event, { taskId, filename }) => {
  try {
    const filePath = path.join(PA_ROOT, 'attachments', taskId, filename);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-attachment-path', (event, { taskId, filename }) => {
  const filePath = path.join(PA_ROOT, 'attachments', taskId, filename);
  return { success: true, path: filePath };
});

// File watching
if (fsSync.existsSync(PA_ROOT)) {
  fileWatcher = chokidar.watch(PA_ROOT, {
    ignored: /(^|[\/\\])\../,
    persistent: true
  });

  fileWatcher.on('change', (filePath) => {
    if (mainWindow) {
      mainWindow.webContents.send('file-changed', filePath);
    }
  });
}

// ============================================================================
// Terminal IPC Handlers (for the main terminal view)
// ============================================================================

ipcMain.handle('start-terminal', () => {
  if (ptyProcess) {
    return { success: false, error: 'Terminal already running' };
  }

  const shell = process.env.SHELL || '/bin/zsh';
  console.log('Starting terminal with shell:', shell, 'in directory:', PA_ROOT);

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cwd: PA_ROOT,
    env: process.env,
  });

  ptyProcess.onData((data) => {
    if (mainWindow) {
      mainWindow.webContents.send('terminal-data', data);
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log('Terminal exited:', { exitCode, signal });
    if (mainWindow) {
      mainWindow.webContents.send('terminal-exit', { exitCode, signal });
    }
    ptyProcess = null;
  });

  return { success: true };
});

ipcMain.handle('terminal-write', (event, data) => {
  if (!ptyProcess) {
    return { success: false, error: 'Terminal not running' };
  }
  ptyProcess.write(data);
  return { success: true };
});

ipcMain.handle('terminal-resize', (event, cols, rows) => {
  if (!ptyProcess) {
    return { success: false, error: 'Terminal not running' };
  }
  ptyProcess.resize(cols, rows);
  return { success: true };
});

// ============================================================================
// Auto-updater IPC Handlers
// ============================================================================

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
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

autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progress);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

autoUpdater.on('error', (error) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-error', error);
  }
});

// ============================================================================
// Agent V2 IPC Handlers
// ============================================================================

ipcMain.handle('spawn-agent', async (event, { task, linkedTaskId }) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized. Set ANTHROPIC_API_KEY.' };
  }
  return await agentManager.createAgent(task, linkedTaskId);
});

ipcMain.handle('get-agents', () => {
  if (!agentManager) {
    return [];
  }
  return agentManager.getAllAgents();
});

ipcMain.handle('get-agent', (event, agentId) => {
  if (!agentManager) {
    return null;
  }
  return agentManager.getAgent(agentId);
});

ipcMain.handle('approve-tool', async (event, { agentId }) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }
  return await agentManager.approveTool(agentId);
});

ipcMain.handle('reject-tool', async (event, { agentId, reason }) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }
  return await agentManager.rejectTool(agentId, reason);
});

ipcMain.handle('provide-feedback', async (event, { agentId, feedback }) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }
  return await agentManager.provideFeedback(agentId, feedback);
});

ipcMain.handle('terminate-agent', async (event, agentId) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }
  return await agentManager.terminateAgent(agentId);
});

ipcMain.handle('get-agent-artifact', async (event, agentId) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }

  const agent = agentManager.getAgent(agentId);
  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  // Try to read artifact from workspace
  try {
    // Try primary artifact first (most recently written file)
    if (agent.primaryArtifact) {
      const artifactPath = path.join(agent.workspaceDir, agent.primaryArtifact);
      const content = await fs.readFile(artifactPath, 'utf-8');
      return { success: true, content, filename: agent.primaryArtifact };
    }

    // Fallback to artifact.md for backwards compatibility
    const artifactPath = path.join(agent.workspaceDir, 'artifact.md');
    const content = await fs.readFile(artifactPath, 'utf-8');
    return { success: true, content, filename: 'artifact.md' };
  } catch (error) {
    return { success: false, error: 'Artifact not found' };
  }
});

// Get agent activity log
ipcMain.handle('get-agent-activity', async (event, agentId) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }

  const agent = agentManager.getAgent(agentId);
  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  return { success: true, activityLog: agent.activityLog || [] };
});

// List files in agent workspace
ipcMain.handle('list-workspace-files', async (event, agentId) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }

  const agent = agentManager.getAgent(agentId);
  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  try {
    const files = await fs.readdir(agent.workspaceDir);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read a file from agent workspace
ipcMain.handle('read-workspace-file', async (event, { agentId, filename }) => {
  if (!agentManager) {
    return { success: false, error: 'Agent manager not initialized' };
  }

  const agent = agentManager.getAgent(agentId);
  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  try {
    const filePath = path.join(agent.workspaceDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content, filename };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
