const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
    // Review process control
    startReview: (config) => ipcRenderer.invoke('start-review', config),
    stopReview: () => ipcRenderer.invoke('stop-review'),
    executeNow: () => ipcRenderer.invoke('execute-now'),

    // Runtime config
    getRuntimeConfig: () => ipcRenderer.invoke('get-runtime-config'),

    // Notifications
    showNotification: (data) => ipcRenderer.invoke('show-notification', data),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Event listeners
    onLogOutput: (callback) => ipcRenderer.on('log-output', (event, data) => callback(data)),
    onReviewStopped: (callback) => ipcRenderer.on('review-stopped', (event, data) => callback(data))
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
