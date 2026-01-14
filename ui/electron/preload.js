import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (relativePath) => ipcRenderer.invoke('read-file', relativePath),
  writeFile: (relativePath, content) => ipcRenderer.invoke('write-file', relativePath, content),
  readAllTasks: () => ipcRenderer.invoke('read-all-tasks'),
  readIdeas: () => ipcRenderer.invoke('read-ideas'),
  readArchive: () => ipcRenderer.invoke('read-archive'),
  getPARoot: () => ipcRenderer.invoke('get-pa-root'),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (event, filePath) => callback(filePath))
});
