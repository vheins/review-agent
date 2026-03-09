const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startReview: (config) => ipcRenderer.invoke('start-review', config),
    stopReview: () => ipcRenderer.invoke('stop-review'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    showNotification: (data) => ipcRenderer.invoke('show-notification', data),
    readContextFile: (fileName) => ipcRenderer.invoke('read-context-file', fileName),
    writeContextFile: (data) => ipcRenderer.invoke('write-context-file', data),
    testAgent: () => ipcRenderer.invoke('test-agent'),
    onLogOutput: (callback) => ipcRenderer.on('log-output', (event, data) => callback(data)),
    onReviewStopped: (callback) => ipcRenderer.on('review-stopped', (event, data) => callback(data))
});
