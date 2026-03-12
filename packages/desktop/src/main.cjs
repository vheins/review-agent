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
                title: 'PR Review Agent',
                body: 'Application is already running!'
            }).show();
        }
    });
}

// Enable hot reload in development
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
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
        const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// Function to start backend server
async function startBackendServer() {
    const port = process.env.API_PORT || 3000;

    // In development, the backend might be started by the root runner (concurrently)
    // We wait a bit longer to see if it pops up before trying to start it ourselves
    const maxRetries = isDev ? 5 : 1;
    for (let i = 0; i < maxRetries; i++) {
        if (await isServerRunning(port)) {
            console.log(`✓ Backend server already running on port ${port}`);
            return true;
        }
        if (isDev) await new Promise(r => setTimeout(r, 1000));
    }

    console.log('🚀 Starting NestJS backend server...');

    const projectRoot = path.join(__dirname, '..', '..');
    const command = 'yarn';
    const args = isDev
        ? ['workspace', '@review-agent/backend', 'dev']
        : ['workspace', '@review-agent/backend', 'start'];

    backendServerProcess = spawn(command, args, {
        cwd: projectRoot,
        env: {
            ...process.env,
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
        const wasRunning = !!backendServerProcess;
        backendServerProcess = null;
        
        if (wasRunning && code !== 0 && code !== null && !app.isQuitting) {
            console.log('⚠ Backend server crashed. Restarting in 2 seconds...');
            setTimeout(() => {
                if (!app.isQuitting) startBackendServer();
            }, 2000);
        }
    });

    // Wait for server to be ready
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (await isServerRunning(port)) {
            console.log(`✓ Backend server started successfully on port ${port}`);
            return true;
        }
    }

    console.error('⚠ Backend server failed to start within 20 seconds');
    return false;
}

function createWindow() {
    const rendererEntryDev = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
    const rendererEntryProd = path.join(__dirname, '..', '..', 'ui', 'dist', 'index.html');

    const preloadPath = path.join(__dirname, 'preload.cjs');
    console.log(`[Electron] Preload path: ${preloadPath}`);
    console.log(`[Electron] Preload exists: ${fs.existsSync(preloadPath)}`);

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 375,
        minHeight: 640,
        backgroundColor: '#020617',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: preloadPath
        }
    });

    if (isDev) {
        mainWindow.loadURL(rendererEntryDev).catch(() => {
            console.log('Failed to load dev server, retrying in 2s...');
            setTimeout(() => mainWindow.loadURL(rendererEntryDev), 2000);
        });
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(rendererEntryProd);
    }
}

app.whenReady().then(async () => {
    await startBackendServer();
    createWindow();
});

app.on('window-all-closed', () => {
    app.isQuitting = true;
    if (reviewProcess) reviewProcess.kill();
    if (backendServerProcess) backendServerProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

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
