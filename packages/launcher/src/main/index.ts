const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { join } = require('node:path');
const { MinecraftProcess, searchMods, getModVersions, downloadMod, getBuiltinMods, installBuiltinMod } = require('./minecraft');
const { getLauncherKey } = require('./keychain');
const { checkForUpdates, downloadUpdate } = require('./updater');
const { setupAuthIpc } = require('./auth');

const isDev = !app.isPackaged;
const API_URL = process.env.API_URL || 'http://api.morisastro.pl:3001';

let mainWindow = null;
let mcProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Astro Launcher',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  setupAuthIpc();

  ipcMain.handle('get-api-url', () => API_URL);
  ipcMain.handle('get-launcher-key', () => getLauncherKey());
  ipcMain.handle('get-mc-dir', () => process.env.MC_DIR || join(process.env.APPDATA || '.', '.astro-launcher', 'minecraft'));
  ipcMain.handle('get-platform', () => process.platform);

  ipcMain.handle('mc:download', async (_event, versionName) => {
    mcProcess = new MinecraftProcess();
    mcProcess.onProgress = (msg, pct) => {
      mainWindow?.webContents.send('mc:progress', { msg, pct });
    };
    await mcProcess.downloadVersion(versionName);
    return true;
  });

  ipcMain.handle('mc:launch', async (_event, versionName, javaPath, mcProfile) => {
    if (!mcProcess) mcProcess = new MinecraftProcess();
    mcProcess.onOutput = (line) => mainWindow?.webContents.send('mc:output', line);
    mcProcess.onError = (line) => mainWindow?.webContents.send('mc:error', line);
    mcProcess.onExit = (code) => mainWindow?.webContents.send('mc:exit', code);
    await mcProcess.launch(versionName, javaPath, mcProfile);
    return true;
  });

  ipcMain.handle('mc:kill', () => {
    mcProcess?.kill();
    mcProcess = null;
    return true;
  });

  ipcMain.handle('mc:status', () => mcProcess?.isRunning() ?? false);

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:quit', () => app.quit());

  ipcMain.handle('update:check', async () => {
    return checkForUpdates();
  });

  ipcMain.handle('update:download', async (_event, url) => {
    const mainWin = mainWindow;
    const path = await downloadUpdate(url, (pct) => {
      mainWin?.webContents.send('update:progress', pct);
    });
    return path;
  });

  ipcMain.handle('update:install', async (_event, path) => {
    shell.openPath(path);
    app.quit();
    return true;
  });

  ipcMain.handle('mod:search', async (_event, query, limit, loader, mcVersion) => {
    return searchMods(query, limit || 20, loader, mcVersion);
  });

  ipcMain.handle('mod:versions', async (_event, modId) => {
    return getModVersions(modId);
  });

  ipcMain.handle('mod:download', async (event, modId, versionId) => {
    const path = await downloadMod(modId, versionId, (pct, msg) => {
      event.sender.send('mod:progress', { pct, msg });
    });
    return path;
  });

  ipcMain.handle('mod:builtin', async () => {
    return getBuiltinMods();
  });

  ipcMain.handle('mod:install-builtin', async (_event, mcVersion) => {
    return installBuiltinMod(mcVersion);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  mcProcess?.kill();
});
