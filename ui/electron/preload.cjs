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
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error))
});

console.log('Preload script loaded successfully');
