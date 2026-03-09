const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let reviewProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (reviewProcess) {
        reviewProcess.kill();
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

// IPC Handlers
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

ipcMain.handle('get-config', async () => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf-8');

        const config = {};
        envContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key) {
                    config[key.trim()] = valueParts.join('=').trim();
                }
            }
        });

        return { success: true, config };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = Object.entries(config)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        fs.writeFileSync(envPath, envContent);
        return { success: true, message: 'Config saved' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
    new Notification({ title, body }).show();
    return { success: true };
});


ipcMain.handle('read-context-file', async (event, fileName) => {
    try {
        let filePath;
        if (fileName === 'agents') {
            filePath = path.join(__dirname, '..', 'agents.md');
        } else {
            filePath = path.join(__dirname, '..', 'context', `${fileName}.md`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content, filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('write-context-file', async (event, { fileName, content }) => {
    try {
        let filePath;
        if (fileName === 'agents') {
            filePath = path.join(__dirname, '..', 'agents.md');
        } else {
            filePath = path.join(__dirname, '..', 'context', `${fileName}.md`);
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, message: 'File saved successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
