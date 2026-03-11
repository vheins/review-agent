const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Single instance lock
const shouldUseSingleInstanceLock = process.env.ELECTRON_DISABLE_SINGLE_INSTANCE_LOCK !== '1';
const gotTheLock = shouldUseSingleInstanceLock ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
    console.log('⚠ Another instance is already running. Exiting...');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            new Notification({
                title: 'Agentic Bunshin',
                body: 'Application is already running!'
            }).show();
        }
    });
}

// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit',
            ignored: /node_modules|[\/\\]\.|dist/,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 100
            }
        });
        console.log('✓ Hot reload enabled for main process');
    } catch (err) {
        console.log('⚠ electron-reload not found');
    }
}

let mainWindow;
let reviewProcess = null;
let backendServerProcess = null;

// Function to check if server is running
async function isServerRunning(port = 3000) {
    return new Promise((resolve) => {
        const http = require('http');
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Function to start backend server
async function startBackendServer() {
    const port = process.env.API_PORT || 3000;

    const isRunning = await isServerRunning(port);
    if (isRunning) {
        console.log(`✓ Backend server already running on port ${port}`);
        return true;
    }

    console.log('🚀 Starting NestJS backend server...');

    // In development, use npm run backend:dev
    const isDev = process.env.NODE_ENV === 'development';
    const command = isDev ? 'npm' : 'node';
    const args = isDev
        ? ['run', 'backend:dev']
        : [path.join(__dirname, '..', 'dist', 'main.js')];

    backendServerProcess = spawn(command, args, {
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            // Remove Electron-specific env vars
            ELECTRON_RUN_AS_NODE: undefined
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
    });

    backendServerProcess.stdout.on('data', (data) => {
        console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendServerProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    backendServerProcess.on('close', (code) => {
        console.log(`Backend server exited with code ${code}`);
        backendServerProcess = null;
    });

    backendServerProcess.on('error', (error) => {
        console.error('Failed to start backend server:', error.message);
        backendServerProcess = null;
    });

    // Wait for server to be ready
    for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (await isServerRunning(port)) {
            console.log(`✓ Backend server started successfully on port ${port}`);
            if (isDev) {
                console.log('✓ Backend server will auto-restart on file changes');
            }
            return true;
        }
    }

    console.error('⚠ Backend server failed to start within 30 seconds');
    return false;
}

function createWindow() {
    const rendererEntry = process.env.VITE_DEV_SERVER_URL || path.join(__dirname, 'dist', 'index.html');

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 375,
        minHeight: 640,
        backgroundColor: '#020617',
        autoHideMenuBar: true,
        minimizable: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(rendererEntry);
    } else {
        mainWindow.loadFile(rendererEntry);
    }

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(async () => {
    await startBackendServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (reviewProcess) {
        reviewProcess.kill();
    }
    if (backendServerProcess) {
        console.log('Stopping backend server...');
        backendServerProcess.kill();
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

// Simple IPC Handlers - just for runtime config
ipcMain.handle('get-runtime-config', async () => {
    const port = process.env.API_PORT || '3000';
    return {
        success: true,
        config: {
            apiBaseUrl: `http://127.0.0.1:${port}/api`,
            wsUrl: `ws://127.0.0.1:${port}`,
            wsUserId: 'electron-dashboard',
            wsToken: process.env.DASHBOARD_SESSION_TOKEN || 'electron-dashboard-token'
        }
    };
});

// Review process control
ipcMain.handle('start-review', async (event, config) => {
    if (reviewProcess) {
        return { success: false, message: 'Review already running' };
    }

    const args = ['src/index.js'];
    if (config.once) args.push('--once');
    if (config.dryRun) args.push('--dry-run');

    reviewProcess = spawn('node', args, {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, ...config.env }
    });

    reviewProcess.stdout.on('data', (data) => {
        mainWindow.webContents.send('log-output', {
            type: 'info',
            message: data.toString()
        });
    });

    reviewProcess.stderr.on('data', (data) => {
        mainWindow.webContents.send('log-output', {
            type: 'error',
            message: data.toString()
        });
    });

    reviewProcess.on('close', (code) => {
        reviewProcess = null;
        mainWindow.webContents.send('review-stopped', { code });
    });

    return { success: true, message: 'Review started' };
});

ipcMain.handle('stop-review', async () => {
    if (reviewProcess) {
        reviewProcess.kill();
        reviewProcess = null;
        return { success: true, message: 'Review stopped' };
    }
    return { success: false, message: 'No review running' };
});

ipcMain.handle('execute-now', async () => {
    if (reviewProcess) {
        reviewProcess.kill('SIGUSR1');
        return { success: true, message: 'Execute now signal sent' };
    }
    return { success: false, message: 'No review running' };
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
    new Notification({ title, body }).show();
    return { success: true };
});

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
    return { success: true };
});
