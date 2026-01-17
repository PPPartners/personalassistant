const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (relativePath) => ipcRenderer.invoke('read-file', relativePath),
  writeFile: (relativePath, content) => ipcRenderer.invoke('write-file', relativePath, content),
  readAllTasks: () => ipcRenderer.invoke('read-all-tasks'),
  readIdeas: () => ipcRenderer.invoke('read-ideas'),
  readArchive: () => ipcRenderer.invoke('read-archive'),
  readSchedule: (date) => ipcRenderer.invoke('read-schedule', date),
  writeSchedule: (date, schedule) => ipcRenderer.invoke('write-schedule', date, schedule),
  getPARoot: () => ipcRenderer.invoke('get-pa-root'),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (event, filePath) => callback(filePath)),

  // Terminal API
  startTerminal: () => ipcRenderer.invoke('start-terminal'),
  terminalWrite: (data) => ipcRenderer.invoke('terminal-write', data),
  terminalResize: (cols, rows) => ipcRenderer.invoke('terminal-resize', cols, rows),
  onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, data) => callback(data)),
  onTerminalExit: (callback) => ipcRenderer.on('terminal-exit', (event, data) => callback(data)),

  // Auto-updater API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),

  // Agent API V2
  spawnAgent: (task, linkedTaskId) => ipcRenderer.invoke('spawn-agent', { task, linkedTaskId }),
  getAgents: () => ipcRenderer.invoke('get-agents'),
  getAgent: (agentId) => ipcRenderer.invoke('get-agent', agentId),
  terminateAgent: (agentId) => ipcRenderer.invoke('terminate-agent', agentId),
  getAgentArtifact: (agentId) => ipcRenderer.invoke('get-agent-artifact', agentId),
  getAgentActivity: (agentId) => ipcRenderer.invoke('get-agent-activity', agentId),
  listWorkspaceFiles: (agentId) => ipcRenderer.invoke('list-workspace-files', agentId),
  readWorkspaceFile: (agentId, filename) => ipcRenderer.invoke('read-workspace-file', { agentId, filename }),

  // Tool approval workflow
  approveTool: (agentId) => ipcRenderer.invoke('approve-tool', { agentId }),
  rejectTool: (agentId, reason) => ipcRenderer.invoke('reject-tool', { agentId, reason }),

  // Feedback workflow
  provideFeedback: (agentId, feedback) => ipcRenderer.invoke('provide-feedback', { agentId, feedback }),

  // Agent events V2
  onAgentStatusChanged: (callback) => ipcRenderer.on('agent-status-changed', (event, data) => callback(data)),
  onAgentNeedsToolApproval: (callback) => ipcRenderer.on('agent-needs-tool-approval', (event, data) => callback(data)),
  onAgentNeedsUserFeedback: (callback) => ipcRenderer.on('agent-needs-user-feedback', (event, data) => callback(data)),

  // Attachment API
  attachFileToTask: (taskId, sourcePath, filename) => ipcRenderer.invoke('attach-file-to-task', { taskId, sourcePath, filename }),
  listTaskAttachments: (taskId) => ipcRenderer.invoke('list-task-attachments', taskId),
  openAttachment: (taskId, filename) => ipcRenderer.invoke('open-attachment', { taskId, filename }),
  deleteAttachment: (taskId, filename) => ipcRenderer.invoke('delete-attachment', { taskId, filename }),
  getAttachmentPath: (taskId, filename) => ipcRenderer.invoke('get-attachment-path', { taskId, filename })
});

console.log('Preload script loaded successfully');
