const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
    startReview: (config) => ipcRenderer.invoke('start-review', config),
    stopReview: () => ipcRenderer.invoke('stop-review'),
    executeNow: () => ipcRenderer.invoke('execute-now'),
    showNotification: (data) => ipcRenderer.invoke('show-notification', data),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getRuntimeConfig: () => ipcRenderer.invoke('get-runtime-config'),
    
    // API Bridges
    getDashboardSnapshot: (options) => ipcRenderer.invoke('get-dashboard-snapshot', options),
    listPRs: (filters) => ipcRenderer.invoke('list-prs', filters),
    getPRDetail: (prId) => ipcRenderer.invoke('get-pr-detail', prId),
    getTeamSecurityData: () => ipcRenderer.invoke('get-team-security-data'),
    setDeveloperAvailability: (payload) => ipcRenderer.invoke('set-developer-availability', payload),
    getRepositoryConfigData: (repositoryId) => ipcRenderer.invoke('get-repository-config-data', repositoryId),
    saveRepositoryConfigData: (payload) => ipcRenderer.invoke('save-repository-config-data', payload),
    exportMetricsData: (payload) => ipcRenderer.invoke('export-metrics-data', payload),
    getHistory: (limit) => ipcRenderer.invoke('get-history', limit),
    getStats: () => ipcRenderer.invoke('get-stats'),
    
    // Event listeners
    onLogOutput: (callback) => ipcRenderer.on('log-output', (event, data) => callback(data)),
    onReviewStopped: (callback) => ipcRenderer.on('review-stopped', (event, data) => callback(data))
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
