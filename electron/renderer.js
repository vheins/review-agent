// State
let isRunning = false;
let stats = {
    totalPRs: 0,
    approved: 0,
    changesRequested: 0,
    manualMerge: 0
};

// Context Editor State
let currentContextFile = 'review-prompt';
let originalContent = '';
let isModified = false;

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = statusBadge.querySelector('.status-text');
const startBtn = document.getElementById('startBtn');
const startOnceBtn = document.getElementById('startOnceBtn');
const stopBtn = document.getElementById('stopBtn');
const logsContainer = document.getElementById('logsContainer');
const activityList = document.getElementById('activityList');
const configForm = document.getElementById('configForm');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
const lastLogContent = document.getElementById('lastLogContent');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileOverlay = document.getElementById('mobileOverlay');
const sidebar = document.querySelector('.sidebar');
const sidebarClose = document.getElementById('sidebarClose');

// Tab Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const tab = item.dataset.tab;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tab).classList.add('active');

        // Close mobile menu on tab change
        closeMobileMenu();
    });
});

// Mobile Menu Toggle
function openMobileMenu() {
    sidebar.classList.add('mobile-open');
    mobileOverlay.classList.add('active');
    mobileMenuToggle.classList.add('active');
    document.body.classList.add('menu-open');
}

function closeMobileMenu() {
    sidebar.classList.remove('mobile-open');
    mobileOverlay.classList.remove('active');
    mobileMenuToggle.classList.remove('active');
    document.body.classList.remove('menu-open');
}

mobileMenuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('mobile-open')) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
});

mobileOverlay.addEventListener('click', () => {
    closeMobileMenu();
});

sidebarClose.addEventListener('click', () => {
    closeMobileMenu();
});

// Load Config
async function loadConfig() {
    const result = await window.electronAPI.getConfig();
    if (result.success) {
        const config = result.config;
        Object.entries(config).forEach(([key, value]) => {
            const input = document.querySelector(`[name="${key}"]`);
            if (input) {
                input.value = value;
            }
        });

        // Toggle AI executor specific fields
        toggleAIExecutorFields(config.AI_EXECUTOR || 'gemini');
    }
}

// Toggle AI Executor Fields
function toggleAIExecutorFields(executor) {
    const geminiEnabledGroup = document.getElementById('geminiEnabledGroup');
    const geminiYoloGroup = document.getElementById('geminiYoloGroup');
    const copilotEnabledGroup = document.getElementById('copilotEnabledGroup');
    const copilotModelGroup = document.getElementById('copilotModelGroup');
    const copilotYoloGroup = document.getElementById('copilotYoloGroup');

    if (executor === 'copilot') {
        // Show all fields when copilot is selected
        geminiEnabledGroup.style.display = 'block';
        geminiYoloGroup.style.display = 'block';
        copilotEnabledGroup.style.display = 'block';
        copilotModelGroup.style.display = 'block';
        copilotYoloGroup.style.display = 'block';
    } else {
        // Show only gemini fields when gemini is selected
        geminiEnabledGroup.style.display = 'block';
        geminiYoloGroup.style.display = 'block';
        copilotEnabledGroup.style.display = 'block';
        copilotModelGroup.style.display = 'none';
        copilotYoloGroup.style.display = 'none';
    }
}

// AI Executor Change Handler
const aiExecutorSelect = document.getElementById('aiExecutor');
if (aiExecutorSelect) {
    aiExecutorSelect.addEventListener('change', (e) => {
        toggleAIExecutorFields(e.target.value);
    });
}

// Save Config
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(configForm);
    const config = Object.fromEntries(formData);

    const result = await window.electronAPI.saveConfig(config);
    if (result.success) {
        addActivity('⚙️', 'Configuration Saved', 'Settings have been updated successfully');
        window.electronAPI.showNotification({
            title: 'Configuration Saved',
            body: 'Your settings have been updated'
        });
    }
});

// Start Review
startBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.startReview({ once: false });
    if (result.success) {
        updateStatus(true);
        addLog('info', 'Review started in continuous mode');
        addActivity('▶️', 'Review Started', 'Continuous review mode activated');
    }
});

startOnceBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.startReview({ once: true });
    if (result.success) {
        updateStatus(true);
        addLog('info', 'Review started in once mode');
        addActivity('⏯️', 'Single Review Started', 'Running one-time review');
    }
});

// Stop Review
stopBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.stopReview();
    if (result.success) {
        updateStatus(false);
        addLog('info', 'Review stopped');
        addActivity('⏹️', 'Review Stopped', 'Review process terminated');
    }
});

// Clear Logs
clearLogsBtn.addEventListener('click', () => {
    logsContainer.innerHTML = '<div class="empty-state">No logs yet. Start a review to see logs.</div>';
});

// Update Status
function updateStatus(running) {
    isRunning = running;

    if (running) {
        statusBadge.classList.add('running');
        statusText.textContent = 'Running';
        startBtn.disabled = true;
        startOnceBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        statusBadge.classList.remove('running');
        statusText.textContent = 'Stopped';
        startBtn.disabled = false;
        startOnceBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// Add Log
function addLog(type, message) {
    if (logsContainer.querySelector('.empty-state')) {
        logsContainer.innerHTML = '';
    }

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Update last log
    updateLastLog(type, message);
}

// Add Activity
function addActivity(icon, title, meta) {
    if (activityList.querySelector('.empty-state')) {
        activityList.innerHTML = '';
    }

    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    activityItem.innerHTML = `
    <div class="activity-icon">${icon}</div>
    <div class="activity-content">
      <div class="activity-title">${title}</div>
      <div class="activity-meta">${meta} • ${new Date().toLocaleTimeString()}</div>
    </div>
  `;
    activityList.insertBefore(activityItem, activityList.firstChild);

    // Keep only last 10 activities
    while (activityList.children.length > 10) {
        activityList.removeChild(activityList.lastChild);
    }
}

// Update Stats
function updateStats() {
    document.getElementById('totalPRs').textContent = stats.totalPRs;
    document.getElementById('approved').textContent = stats.approved;
    document.getElementById('changesRequested').textContent = stats.changesRequested;
    document.getElementById('manualMerge').textContent = stats.manualMerge;
}

// Parse Log Output
function parseLogOutput(message) {
    // Detect PR events
    if (message.includes('approved and merged')) {
        stats.approved++;
        stats.totalPRs++;
        updateStats();
        addActivity('✅', 'PR Approved & Merged', message.substring(0, 100));
    } else if (message.includes('Changes Requested') || message.includes('REQUEST_CHANGES')) {
        stats.changesRequested++;
        stats.totalPRs++;
        updateStats();
        addActivity('🔍', 'Changes Requested', message.substring(0, 100));
    } else if (message.includes('Manual Merge Reired') || message.includes('MANUAL MERGE')) {
        stats.manualMerge++;
        stats.totalPRs++;
        updateStats();
        addActivity('⚠️', 'Manual Merge Required', message.substring(0, 100));
    } else if (message.includes('Found') && message.includes('PRs')) {
        const match = message.match(/Found (\d+)/);
        if (match) {
            addActivity('📊', `Found ${match[1]} PRs`, 'Scanning for pull requests');
        }
    }
}

// Listen to Log Output
window.electronAPI.onLogOutput((data) => {
    addLog(data.type, data.message);
    parseLogOutput(data.message);
});

// Listen to Review Stopped
window.electronAPI.onReviewStopped((data) => {
    updateStatus(false);
    addLog('info', `Review process exited with code ${data.code}`);
    addActivity('⏹️', 'Review Completed', `Process exited with code ${data.code}`);
});

// Initialize
loadConfig();
updateStats();

// Load initial context file
setTimeout(() => {
    loadContextFile('review-prompt');
}, 100);

// Context Editor DOM Elements

const contextEditor = document.getElementById('contextEditor');
const editorFileName = document.getElementById('editorFileName');
const editorInfo = document.getElementById('editorInfo');
const saveContextBtn = document.getElementById('saveContextBtn');
const reloadContextBtn = document.getElementById('reloadContextBtn');

// Context Tab Switching
document.querySelectorAll('.context-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
        if (isModified) {
            const confirm = window.confirm('You have unsaved changes. Do you want to discard them?');
            if (!confirm) return;
        }

        const fileName = tab.dataset.file;

        // Update tabs
        document.querySelectorAll('.context-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Load file
        await loadContextFile(fileName);
    });
});

// Load Context File
async function loadContextFile(fileName) {
    currentContextFile = fileName;

    const result = await window.electronAPI.readContextFile(fileName);
    if (result.success) {
        contextEditor.value = result.content;
        originalContent = result.content;
        isModified = false;

        // Update UI
        if (fileName === 'agents') {
            editorFileName.textContent = 'agents.md';
        } else {
            editorFileName.textContent = `context/${fileName}.md`;
        }

        editorInfo.textContent = 'Ready';
        editorInfo.className = 'editor-info';
        saveContextBtn.disabled = true;
    } else {
        editorInfo.textContent = `Error: ${result.error}`;
        editorInfo.className = 'editor-info';
    }
}

// Track Changes
contextEditor.addEventListener('input', () => {
    isModified = contextEditor.value !== originalContent;

    if (isModified) {
        editorInfo.textContent = 'Modified (unsaved)';
        editorInfo.className = 'editor-info modified';
        saveContextBtn.disabled = false;
    } else {
        editorInfo.textContent = 'Ready';
        editorInfo.className = 'editor-info';
        saveContextBtn.disabled = true;
    }
});

// Save Context File
saveContextBtn.addEventListener('click', async () => {
    const content = contextEditor.value;

    const result = await window.electronAPI.writeContextFile({
        fileName: currentContextFile,
        content
    });

    if (result.success) {
        originalContent = content;
        isModified = false;

        editorInfo.textContent = 'Saved successfully';
        editorInfo.className = 'editor-info saved';
        saveContextBtn.disabled = true;

        window.electronAPI.showNotification({
            title: 'Context File Saved',
            body: `${editorFileName.textContent} has been saved`
        });

        addActivity('💾', 'Context File Saved', editorFileName.textContent);

        setTimeout(() => {
            editorInfo.textContent = 'Ready';
            editorInfo.className = 'editor-info';
        }, 3000);
    } else {
        editorInfo.textContent = `Error: ${result.error}`;
        editorInfo.className = 'editor-info';
    }
});

// Reload Context File
reloadContextBtn.addEventListener('click', async () => {
    if (isModified) {
        const confirm = window.confirm('You have unsaved changes. Do you want to discard them?');
        if (!confirm) return;
    }

    await loadContextFile(currentContextFile);
    addActivity('🔄', 'Context File Reloaded', editorFileName.textContent);
});

// Load initial context file
loadContextFile('review-prompt');


// Theme Toggle
let currentTheme = localStorage.getItem('theme') || 'dark';

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        themeIcon.textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        themeIcon.textContent = '🌙';
    }
    currentTheme = theme;
    localStorage.setItem('theme', theme);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        addActivity('🎨', 'Theme Changed', `Switched to ${newTheme} mode`);
    });
}

// Apply saved theme on load
applyTheme(currentTheme);

// Update Last Log
function updateLastLog(type, message) {
    lastLogContent.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    lastLogContent.className = `last-log-content ${type}`;
}


// Agent Tab Functionality
const agentForm = document.getElementById('agentForm');

// Agent Tab Switching
document.querySelectorAll('.agent-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const agent = tab.dataset.agent;

        // Update tabs
        document.querySelectorAll('.agent-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update config sections
        document.querySelectorAll('.agent-config').forEach(c => c.classList.remove('active'));
        document.getElementById(`${agent}-config`).classList.add('active');
    });
});

// Load Agent Config
async function loadAgentConfig() {
    const result = await window.electronAPI.getConfig();
    if (result.success) {
        const config = result.config;

        // Gemini config
        const geminiEnabled = document.getElementById('agentGeminiEnabled');
        const geminiModel = document.getElementById('agentGeminiModel');
        const geminiYolo = document.getElementById('agentGeminiYolo');
        if (geminiEnabled) geminiEnabled.value = config.GEMINI_ENABLED || 'true';
        if (geminiModel) geminiModel.value = config.GEMINI_MODEL || 'auto-3';
        if (geminiYolo) geminiYolo.value = config.GEMINI_YOLO || 'false';

        // Copilot config
        const copilotEnabled = document.getElementById('agentCopilotEnabled');
        const copilotModel = document.getElementById('agentCopilotModel');
        const copilotYolo = document.getElementById('agentCopilotYolo');
        if (copilotEnabled) copilotEnabled.value = config.COPILOT_ENABLED || 'false';
        if (copilotModel) copilotModel.value = config.COPILOT_MODEL || 'claude-haiku-4.5';
        if (copilotYolo) copilotYolo.value = config.COPILOT_YOLO || 'false';

        // Update status indicators
        updateAgentStatus('gemini', config.GEMINI_ENABLED === 'true');
        updateAgentStatus('copilot', config.COPILOT_ENABLED === 'true');
    }
}

// Update Agent Status Indicator
function updateAgentStatus(agent, enabled) {
    const statusElement = document.getElementById(`${agent}Status`);
    if (statusElement) {
        const statusText = statusElement.querySelector('.status-text');
        if (enabled) {
            statusElement.classList.add('enabled');
            statusText.textContent = 'Enabled';
        } else {
            statusElement.classList.remove('enabled');
            statusText.textContent = 'Disabled';
        }
    }
}

// Save Agent Config
if (agentForm) {
    agentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(agentForm);
        const config = Object.fromEntries(formData);

        const result = await window.electronAPI.saveConfig(config);
        if (result.success) {
            addActivity('🤖', 'Agent Configuration Saved', 'AI executor settings have been updated');
            window.electronAPI.showNotification({
                title: 'Agent Configuration Saved',
                body: 'Your AI executor settings have been updated'
            });

            // Update status indicators
            updateAgentStatus('gemini', config.GEMINI_ENABLED === 'true');
            updateAgentStatus('copilot', config.COPILOT_ENABLED === 'true');

            // Reload main config to sync
            loadConfig();
        }
    });
}

// Real-time status update on change
document.getElementById('agentGeminiEnabled')?.addEventListener('change', (e) => {
    updateAgentStatus('gemini', e.target.value === 'true');
});

document.getElementById('agentCopilotEnabled')?.addEventListener('change', (e) => {
    updateAgentStatus('copilot', e.target.value === 'true');
});

// Load agent config on startup
loadAgentConfig();
