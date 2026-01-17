import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import chokidar from 'chokidar';
import os from 'os';
import pty from 'node-pty';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to PersonalAssistant root (data directory)
// Always use ~/PersonalAssistant for data, regardless of where code lives
const PA_ROOT = path.join(os.homedir(), 'PersonalAssistant');

let mainWindow;
let fileWatcher;
let ptyProcess;

// Utility: Strip ANSI escape codes from terminal output
function stripAnsi(text) {
  // Remove all ANSI escape sequences
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

// Utility: Parse Claude Code dialog box from terminal output
function parseClaudeCodeDialog(cleanText) {
  // Find all box boundaries (╭ and ╰ pairs)
  // We want the OUTERMOST box, which contains the question and numbered options

  // Look for the outermost dialog box - find the last ╰─+╯ and work backwards
  const lines = cleanText.split('\n');
  let lastBoxEnd = -1;
  let firstBoxStart = -1;

  // Find last closing box
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('╰') && lines[i].includes('╯')) {
      lastBoxEnd = i;
      break;
    }
  }

  if (lastBoxEnd === -1) return null;

  // Find first opening box before the last closing
  for (let i = 0; i <= lastBoxEnd; i++) {
    if (lines[i].includes('╭') && lines[i].includes('╮')) {
      firstBoxStart = i;
      break;
    }
  }

  if (firstBoxStart === -1) return null;

  // Extract the outermost dialog content
  const dialogLines = lines.slice(firstBoxStart + 1, lastBoxEnd);
  const dialogContent = dialogLines.join('\n');

  // Extract title (first line with │)
  const titleLine = dialogLines.find(line => line.includes('│') && !line.includes('╭') && !line.includes('╰'));
  const titleMatch = titleLine ? titleLine.match(/│\s*([^│]+?)\s*│/) : null;
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract file preview (look for inner nested box)
  let filePreview = null;
  let innerBoxStart = -1;
  let innerBoxEnd = -1;

  for (let i = 0; i < dialogLines.length; i++) {
    if (dialogLines[i].includes('╭') && innerBoxStart === -1) {
      innerBoxStart = i;
    }
    if (dialogLines[i].includes('╰') && innerBoxStart !== -1) {
      innerBoxEnd = i;
      break;
    }
  }

  if (innerBoxStart !== -1 && innerBoxEnd !== -1) {
    const innerLines = dialogLines.slice(innerBoxStart + 1, innerBoxEnd);
    const firstInnerLine = innerLines.find(line => line.includes('│'));
    const filenameMatch = firstInnerLine ? firstInnerLine.match(/│\s*([^\s│]+\.\w+)/) : null;
    const filename = filenameMatch ? filenameMatch[1].trim() : null;

    const contentLines = innerLines
      .filter(line => line.includes('│'))
      .map(line => {
        const match = line.match(/│\s*(.+?)\s*│/);
        return match ? match[1] : '';
      })
      .slice(1); // Skip filename line

    if (filename) {
      filePreview = {
        filename,
        content: contentLines.join('\n').trim()
      };
    }
  }

  // Extract question (line with ?)
  const questionLine = dialogLines.find(line => line.includes('?') && line.includes('│'));
  const questionMatch = questionLine ? questionLine.match(/│\s*(.+\?)\s*│/) : null;
  const question = questionMatch ? questionMatch[1].trim() : '';

  // Extract numbered options (lines with ❯ or just numbered)
  const optionLines = dialogLines.filter(line => {
    // Match lines like: │ ❯ 1. Yes │ or │   2. No │
    return line.match(/│\s*[❯>]?\s*\d+\./);
  });

  const options = optionLines.map(line => {
    const match = line.match(/│\s*[❯>]?\s*(\d+\.\s*.+?)\s*│/);
    return match ? match[1].trim() : '';
  }).filter(Boolean);

  // Only return dialog if we found options (otherwise it's not an interactive dialog)
  if (options.length === 0) return null;

  return {
    title,
    question,
    options,
    filePreview
  };
}

// Agent management system
const agentProcesses = new Map(); // agentId -> { pty, agent, outputBuffer }
const AGENTS_DIR = path.join(PA_ROOT, 'agents');
const WORKSPACES_DIR = path.join(AGENTS_DIR, 'workspaces');

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

app.whenReady().then(() => {
  createWindow();
});

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

// ============================================
// AGENT SYSTEM IPC HANDLERS
// ============================================

// Helper: Parse status markers from agent output
function parseAgentStatus(output) {
  const statusMatch = output.match(/claude-agent-status:\s*(working|completed|waiting_review|failed)/);
  const artifactMatch = output.match(/claude-agent-artifact:\s*(.+)/);
  const needsReviewMatch = output.match(/claude-agent-needs-review:\s*(true|false)/);

  return {
    status: statusMatch ? statusMatch[1] : null,
    artifactPath: artifactMatch ? artifactMatch[1].trim() : null,
    needsReview: needsReviewMatch ? needsReviewMatch[1] === 'true' : null
  };
}

// Helper: Generate unique agent ID
function generateAgentId() {
  return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Detect and handle questions from Claude Code output (called after output stabilizes)
function detectAndHandleQuestion(agentId, agent, mainWindow) {
  // Safety: Only detect questions if still in working state
  if (agent.state !== 'working') {
    console.log(`[Agent ${agentId}] Question detection skipped - not in working state (current: ${agent.state})`);
    return;
  }

  // Guard: Skip if agent just started (within 5 seconds of prompt display)
  const timeSincePromptStart = Date.now() - (agent.promptStartTime || 0);
  if (timeSincePromptStart < 5000) {
    console.log(`[Agent ${agentId}] Question detection skipped - too soon after prompt (${Math.round(timeSincePromptStart / 1000)}s < 5s)`);
    return;
  }

  const recentText = agent.recentOutput;
  const cleanText = stripAnsi(recentText);

  // Guard: Skip if our own prompt text is still in recent output (prevents detecting prompt instructions as questions)
  const promptSnippet = stripAnsi(agent.promptText).substring(0, 200); // Check first 200 chars of prompt
  if (cleanText.includes(promptSnippet.substring(0, 100))) {
    console.log(`[Agent ${agentId}] Question detection skipped - prompt text still in output`);
    return;
  }

  console.log(`[Agent ${agentId}] Running question detection (output stable for 500ms)...`);
  console.log(`[Agent ${agentId}] Analyzing ${cleanText.length} chars of clean text`);
  console.log(`[Agent ${agentId}] Last 500 chars: ${cleanText.slice(-500)}`);

  // PRIORITY 1: Check for explicit [ORCHESTRATOR-QUESTION] marker
  // But NOT if it's in an example (preceded by "Example:")
  const markedQuestionMatch = cleanText.match(/\[ORCHESTRATOR-QUESTION\]\s*(.+)/);
  if (markedQuestionMatch) {
    // Check if this is from our example in the prompt
    const fullLine = cleanText.split('\n').find(line => line.includes('[ORCHESTRATOR-QUESTION]'));
    if (fullLine && fullLine.toLowerCase().includes('example:')) {
      console.log(`[Agent ${agentId}] Skipping [ORCHESTRATOR-QUESTION] - it's in the example from our prompt`);
    } else {
      const question = markedQuestionMatch[1].trim();

      console.log(`[Agent ${agentId}] STATE: working → waiting_for_user_input (marked question)`);
      console.log(`[Agent ${agentId}] Question: ${question}`);

      agent.state = 'waiting_for_user_input';
      agent.currentQuestion = question;
      agent.questionOptions = null;

      const context = cleanText.split('\n').slice(-10).join('\n');

      if (mainWindow) {
        mainWindow.webContents.send('agent-needs-input', {
          agentId,
          title: 'Agent Has a Question',
          question,
          context,
          options: null,
          inputType: 'text'
        });
      }
      return;
    }
  }

  // PRIORITY 2: Try to parse Claude Code dialog box
  const dialog = parseClaudeCodeDialog(cleanText);

  if (dialog && dialog.options.length > 0) {
    console.log(`[Agent ${agentId}] STATE: working → waiting_for_user_input (dialog box)`);
    console.log(`[Agent ${agentId}] Parsed dialog:`, dialog);

    agent.state = 'waiting_for_user_input';
    agent.currentQuestion = dialog.question || dialog.title;
    agent.questionOptions = dialog.options;

    // Store the full dialog data for retrieval
    agent.currentDialog = {
      agentId,
      title: dialog.title,
      question: dialog.question,
      options: dialog.options,
      filePreview: dialog.filePreview,
      inputType: 'dialog'
    };

    if (mainWindow) {
      mainWindow.webContents.send('agent-needs-input', agent.currentDialog);
    }
    return;
  }

  // PRIORITY 3: Fallback - Detect numbered menu without full dialog structure
  const hasNumberedOptions = cleanText.match(/[❯>]?\s*1\.\s+\w+/);
  if (hasNumberedOptions) {
    const optionLines = cleanText.split('\n')
      .filter(line => line.match(/^\s*[❯>]?\s*\d+\.\s+/));

    const options = optionLines.map(line => {
      const match = line.match(/[❯>]?\s*(\d+\.\s+.+?)$/);
      return match ? match[1].trim() : line.trim();
    }).filter(Boolean);

    if (options.length >= 2) {
      const questionLines = cleanText.split('\n').filter(line => line.includes('?'));
      const question = questionLines.length > 0
        ? questionLines[questionLines.length - 1].trim()
        : 'Claude Code needs your input';

      console.log(`[Agent ${agentId}] STATE: working → waiting_for_user_input (fallback numbered)`);
      console.log(`[Agent ${agentId}] Question: ${question}`);
      console.log(`[Agent ${agentId}] Options:`, options);

      agent.state = 'waiting_for_user_input';
      agent.currentQuestion = question;
      agent.questionOptions = options;

      if (mainWindow) {
        mainWindow.webContents.send('agent-needs-input', {
          agentId,
          title: 'Claude Code Needs Input',
          question,
          options,
          inputType: 'numbered'
        });
      }
      return;
    }
  }

  // PRIORITY 4: Detect yes/no questions (y/n format)
  const ynMatch = cleanText.match(/\(y\/n\)|\[y\/N\]|\[Y\/n\]/i);
  if (ynMatch) {
    const lines = cleanText.split('\n');
    const questionLine = lines.find(line => line.match(/\(y\/n\)|\[y\/N\]|\[Y\/n\]/i));
    const question = questionLine ? stripAnsi(questionLine).trim() : 'Claude Code needs confirmation';

    console.log(`[Agent ${agentId}] STATE: working → waiting_for_user_input (y/n)`);
    console.log(`[Agent ${agentId}] Question: ${question}`);

    agent.state = 'waiting_for_user_input';
    agent.currentQuestion = question;
    agent.questionOptions = ['Yes', 'No'];

    if (mainWindow) {
      mainWindow.webContents.send('agent-needs-input', {
        agentId,
        title: 'Confirmation Required',
        question,
        options: ['Yes', 'No'],
        inputType: 'buttons'
      });
    }
    return;
  }

  console.log(`[Agent ${agentId}] No question detected - agent still working`);
}

// Helper: Create initial agent prompt
function createAgentPrompt(task) {
  return `You are a focused AI assistant working on a specific task.

Task: ${task}

Important Instructions:
- If you need to ask the user a free-text question, prefix it with: [ORCHESTRATOR-QUESTION]
  Example: [ORCHESTRATOR-QUESTION] Should I use React or Vue for this component?
- Save your final output to a file called 'artifact.md' in the current directory
- When done, type exactly: claude-agent-status: completed
- If your work needs human review before using, type: claude-agent-needs-review: true
- If your work is ready to use as-is, type: claude-agent-needs-review: false

Note: Claude Code's built-in dialogs (file creation, confirmations) will be automatically detected.
Only use [ORCHESTRATOR-QUESTION] for your own open-ended questions.

Begin working now.

`;
}

// Spawn a new agent
ipcMain.handle('spawn-agent', async (event, { task, linkedTaskId = null }) => {
  try {
    const agentId = generateAgentId();
    const workspaceDir = path.join(WORKSPACES_DIR, agentId);

    // Create workspace directory
    await fs.mkdir(workspaceDir, { recursive: true });

    // Create the agent prompt
    const prompt = createAgentPrompt(task);

    // Create agent object
    const agent = {
      id: agentId,
      name: task.substring(0, 50), // Use first 50 chars of task as name
      task,
      linkedTaskId,
      // State machine: initializing → working → waiting_for_user_input | waiting_for_completion_review → completed/failed
      state: 'initializing',
      status: 'working', // UI display status (keep for compatibility)
      createdAt: new Date().toISOString(),
      artifact: null,
      outputBuffer: [],
      workingDirectory: workspaceDir,
      currentQuestion: null, // Stores current question when waiting_for_user_input
      questionOptions: null, // Stores options for numbered menus
      // Debouncing & guards
      questionDetectionTimeout: null, // Timer for debouncing question detection
      lastOutputTime: Date.now(), // Track when last output was received
      promptStartTime: null, // Track when prompt display started (set when state → working)
      promptText: prompt // Store our own prompt text to avoid false positives
    };

    // Spawn PTY for this agent
    const shell = process.env.SHELL || '/bin/zsh';
    const agentPty = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: workspaceDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    // Track if initial prompt has been displayed
    agent.promptDisplayed = false;

    // Track recent output for pattern matching (last 5000 chars)
    agent.recentOutput = '';

    // Listen for data from agent's PTY
    agentPty.onData((data) => {
      // Add to output buffer
      agent.outputBuffer.push(data);

      // Keep buffer manageable (last 10000 lines)
      if (agent.outputBuffer.length > 10000) {
        agent.outputBuffer = agent.outputBuffer.slice(-10000);
      }

      // Add to recent output buffer for pattern matching
      agent.recentOutput += data;
      if (agent.recentOutput.length > 10000) {
        agent.recentOutput = agent.recentOutput.slice(-10000);
      }

      // Update last output time (for debouncing)
      agent.lastOutputTime = Date.now();

      // STATE TRANSITION: initializing → working
      // Wait for initial prompt to be displayed, then move to working state
      if (agent.state === 'initializing' && data.includes('Begin working now')) {
        agent.state = 'working';
        agent.promptDisplayed = true;
        agent.promptStartTime = Date.now(); // Track when we entered working state
        console.log(`[Agent ${agentId}] STATE: initializing → working (prompt displayed, orchestrator active)`);
        return;
      }

      // ORCHESTRATOR: Detect questions from Claude Code (only when in working state)
      if (agent.state === 'working') {
        // Clear any existing debounce timer (output is still flowing)
        if (agent.questionDetectionTimeout) {
          clearTimeout(agent.questionDetectionTimeout);
          agent.questionDetectionTimeout = null;
        }

        // Schedule question detection after output stabilizes (500ms of no new output)
        agent.questionDetectionTimeout = setTimeout(() => {
          detectAndHandleQuestion(agentId, agent, mainWindow);
        }, 500);
      }

      // Parse for status markers (ONLY when in working state - prevents false positives from prompt redisplays)
      if (agent.state === 'working') {
        const parsed = parseAgentStatus(data);

        // Log all output for debugging
        if (data.includes('claude-agent')) {
          console.log(`[Agent ${agentId}] Detected marker in output (state: ${agent.state}):`, data);
          console.log(`[Agent ${agentId}] Parsed:`, parsed);
        }

        if (parsed.status) {
          console.log(`[Agent ${agentId}] Marker detected - Status: ${parsed.status}, Artifact: ${parsed.artifactPath}`);

          // Agent claims completion - verify artifact exists and ask user for approval
          if (parsed.status === 'completed') {
            const artifactPath = parsed.artifactPath || 'artifact.md';
            const artifactFullPath = path.join(workspaceDir, artifactPath);

            // Check if artifact file exists
            const artifactExists = fsSync.existsSync(artifactFullPath);

            if (artifactExists) {
              console.log(`[Agent ${agentId}] ✓ Artifact verified at ${artifactPath}`);

              // Read artifact
              fs.readFile(artifactFullPath, 'utf-8')
                .then(content => {
                  agent.artifact = {
                    type: 'markdown',
                    content,
                    path: artifactPath,
                    needsReview: parsed.needsReview !== false
                  };

                  // STATE TRANSITION: working → waiting_for_completion_review
                  agent.state = 'waiting_for_completion_review';
                  console.log(`[Agent ${agentId}] STATE: working → waiting_for_completion_review (artifact loaded, awaiting user approval)`);

                  // Notify UI to show artifact for review
                  if (mainWindow) {
                    mainWindow.webContents.send('agent-needs-review', {
                      agentId,
                      artifact: agent.artifact,
                      question: 'Agent claims task is complete. Does this look good?'
                    });
                  }
                })
                .catch(err => {
                  console.error(`[Agent ${agentId}] Failed to read artifact:`, err);
                  agent.state = 'failed';
                  agent.status = 'failed';
                  if (mainWindow) {
                    mainWindow.webContents.send('agent-status-changed', {
                      agentId,
                      status: 'failed',
                      error: `Failed to read artifact: ${err.message}`
                    });
                  }
                });
            } else {
              // FALSE POSITIVE: Completion marker detected but no artifact exists
              console.log(`[Agent ${agentId}] ✗ False positive - completion marker detected but no artifact at ${artifactPath}, staying in working state`);
              // Don't change state, stay in working state
            }
          } else if (parsed.status === 'failed') {
            // STATE TRANSITION: working → failed
            agent.state = 'failed';
            agent.status = 'failed';
            console.log(`[Agent ${agentId}] STATE: working → failed`);

            if (mainWindow) {
              mainWindow.webContents.send('agent-status-changed', {
                agentId,
                status: 'failed'
              });
            }
          }
        }
      }

      // Send output data to renderer
      if (mainWindow) {
        mainWindow.webContents.send('agent-data', { agentId, data });
      }
    });

    // Handle PTY exit
    agentPty.onExit(({ exitCode, signal }) => {
      console.log(`[Agent ${agentId}] PTY exited (state: ${agent.state}, exitCode: ${exitCode}, signal: ${signal})`);

      // Only mark as failed if not already in completed state
      if (agent.state !== 'completed') {
        // STATE TRANSITION: any → failed
        agent.state = 'failed';
        agent.status = 'failed';
        console.log(`[Agent ${agentId}] STATE: ${agent.state} → failed (PTY exited unexpectedly)`);

        if (mainWindow) {
          mainWindow.webContents.send('agent-status-changed', {
            agentId,
            status: 'failed',
            error: `Process exited unexpectedly (code: ${exitCode}, signal: ${signal})`
          });
        }
      }
    });

    // Store agent and PTY
    agentProcesses.set(agentId, { pty: agentPty, agent });

    // Create a prompt file in the workspace (using the prompt we already created)
    const promptFile = path.join(workspaceDir, '.agent_prompt.txt');
    await fs.writeFile(promptFile, prompt, 'utf-8');

    console.log(`[Agent ${agentId}] Created agent for task: ${task}`);
    console.log(`[Agent ${agentId}] Workspace: ${workspaceDir}`);
    console.log(`[Agent ${agentId}] Initial status: ${agent.status}`);

    // Wait a moment for shell to be ready, then start Claude Code
    setTimeout(() => {
      // Start Claude Code with the prompt as a command-line argument
      const command = `claude "$(cat .agent_prompt.txt)"\r`;
      console.log(`[Agent ${agentId}] Sending command: ${command.trim()}`);
      agentPty.write(command);
    }, 1000);

    console.log(`[Agent ${agentId}] Spawned successfully`);

    return { success: true, agent };
  } catch (error) {
    console.error('Failed to spawn agent:', error);
    return { success: false, error: error.message };
  }
});

// Get list of all agents
ipcMain.handle('get-agents', () => {
  const agents = [];
  for (const [agentId, { agent }] of agentProcesses.entries()) {
    agents.push({
      id: agent.id,
      name: agent.name,
      task: agent.task,
      linkedTaskId: agent.linkedTaskId,
      state: agent.state, // New: state machine state
      status: agent.status,
      createdAt: agent.createdAt,
      artifact: agent.artifact,
      workingDirectory: agent.workingDirectory,
      currentQuestion: agent.currentQuestion, // New: current question when waiting for input
      questionOptions: agent.questionOptions, // New: options for numbered menus
      currentDialog: agent.currentDialog      // New: full dialog data (title, options, filePreview, inputType)
    });
  }
  return agents;
});

// Get agent output buffer
ipcMain.handle('get-agent-output', (event, agentId) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }
  return { success: true, output: agentData.agent.outputBuffer.join('') };
});

// Send command to agent
ipcMain.handle('send-agent-command', (event, { agentId, command }) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }

  agentData.pty.write(command);
  return { success: true };
});

// Send feedback to agent (restarts work with feedback)
ipcMain.handle('send-agent-feedback', (event, { agentId, feedback }) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }

  // Add feedback to agent history
  if (!agentData.agent.feedbackHistory) {
    agentData.agent.feedbackHistory = [];
  }
  agentData.agent.feedbackHistory.push(feedback);

  // Update status to working
  agentData.agent.status = 'working';

  // Send feedback as command
  const feedbackPrompt = `\n\nPlease revise your work based on this feedback:\n${feedback}\n\nSave the revised output to artifact.md and type 'claude-agent-status: completed' when done.\n`;
  agentData.pty.write(feedbackPrompt);

  // Notify renderer
  if (mainWindow) {
    mainWindow.webContents.send('agent-status-changed', {
      agentId,
      status: 'working'
    });
  }

  return { success: true };
});

// Terminate agent
ipcMain.handle('terminate-agent', async (event, agentId) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }

  try {
    // Kill PTY process
    agentData.pty.kill();

    // Remove from map
    agentProcesses.delete(agentId);

    // Optionally clean up workspace (commented out for debugging)
    // await fs.rm(agentData.agent.workingDirectory, { recursive: true, force: true });

    console.log(`Terminated agent ${agentId}`);

    return { success: true };
  } catch (error) {
    console.error('Failed to terminate agent:', error);
    return { success: false, error: error.message };
  }
});

// Send user input to agent (when in waiting_for_user_input state)
ipcMain.handle('agent-send-input', (event, { agentId, input }) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }

  const { agent, pty } = agentData;

  if (agent.state !== 'waiting_for_user_input') {
    return { success: false, error: `Agent not waiting for input (state: ${agent.state})` };
  }

  try {
    console.log(`[Agent ${agentId}] User provided input: ${input}`);

    // Send input to PTY - Claude Code dialogs seem to need \n instead of \r
    console.log(`[Agent ${agentId}] Writing to PTY: "${input}"`);
    pty.write(`${input}\n`);

    // STATE TRANSITION: waiting_for_user_input → working
    agent.state = 'working';
    agent.currentQuestion = null;
    agent.questionOptions = null;
    agent.currentDialog = null; // Clear dialog data
    console.log(`[Agent ${agentId}] STATE: waiting_for_user_input → working (user input sent)`);

    // Notify renderer of state change
    if (mainWindow) {
      mainWindow.webContents.send('agent-status-changed', {
        agentId,
        state: 'working'
      });
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to send input to agent ${agentId}:`, error);
    return { success: false, error: error.message };
  }
});

// Approve agent completion (when in waiting_for_completion_review state)
ipcMain.handle('agent-approve-completion', (event, { agentId }) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }

  const { agent } = agentData;

  if (agent.state !== 'waiting_for_completion_review') {
    return { success: false, error: `Agent not in review state (state: ${agent.state})` };
  }

  try {
    console.log(`[Agent ${agentId}] User approved completion`);

    // STATE TRANSITION: waiting_for_completion_review → completed
    agent.state = 'completed';
    agent.status = 'completed';
    console.log(`[Agent ${agentId}] STATE: waiting_for_completion_review → completed (user approved)`);

    // Notify UI
    if (mainWindow) {
      mainWindow.webContents.send('agent-status-changed', {
        agentId,
        status: 'completed',
        artifact: agent.artifact
      });
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to approve completion for agent ${agentId}:`, error);
    return { success: false, error: error.message };
  }
});

// Reject completion and optionally send feedback to continue working
ipcMain.handle('agent-continue-working', (event, { agentId, feedback = null }) => {
  const agentData = agentProcesses.get(agentId);
  if (!agentData) {
    return { success: false, error: 'Agent not found' };
  }

  const { agent, pty } = agentData;

  if (agent.state !== 'waiting_for_completion_review') {
    return { success: false, error: `Agent not in review state (state: ${agent.state})` };
  }

  try {
    console.log(`[Agent ${agentId}] User rejected completion, continuing work`);
    if (feedback) {
      console.log(`[Agent ${agentId}] User feedback: ${feedback}`);
    }

    // STATE TRANSITION: waiting_for_completion_review → working
    agent.state = 'working';
    console.log(`[Agent ${agentId}] STATE: waiting_for_completion_review → working (user requested changes)`);

    // Send feedback to agent if provided
    if (feedback) {
      pty.write(`${feedback}\r`);
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to continue working for agent ${agentId}:`, error);
    return { success: false, error: error.message };
  }
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
