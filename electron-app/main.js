const { app, BrowserWindow, session } = require('electron');
const path = require('path');

let mainWindow;

// Security: Disable remote module
app.on('remote-require', (event) => {
    event.preventDefault();
});

app.on('remote-get-builtin', (event) => {
    event.preventDefault();
});

app.on('remote-get-global', (event) => {
    event.preventDefault();
});

app.on('remote-get-current-window', (event) => {
    event.preventDefault();
});

app.on('remote-get-current-web-contents', (event) => {
    event.preventDefault();
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true, // Security: Enable sandbox
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js'),
            enableRemoteModule: false, // Security: Explicitly disable remote module
            allowRunningInsecureContent: false // Security: Block insecure content
        }
    });

    // Security: Set up permission handlers
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['notifications']; // Only allow notifications
        
        if (allowedPermissions.includes(permission)) {
            console.log(`[SECURITY] Allowing permission: ${permission}`);
            callback(true);
        } else {
            console.log(`[SECURITY] Blocking permission: ${permission}`);
            callback(false);
        }
    });

    // Security: Block dangerous protocols
    session.defaultSession.protocol.interceptFileProtocol('file', (request, callback) => {
        console.log(`[SECURITY] File protocol blocked: ${request.url}`);
        callback({ error: -3 }); // ERR_ABORTED
    });

    mainWindow.loadFile('index.html');
    
    // Open DevTools only in development
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
