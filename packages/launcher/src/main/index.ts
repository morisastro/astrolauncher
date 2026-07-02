import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { MinecraftProcess } from './minecraft.js';
import { getLauncherKey } from './keychain.js';
import { checkForUpdates, downloadUpdate, type UpdateInfo } from './updater.js';

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
const API_URL = process.env.API_URL || 'http://api.morisastro.pl:3001';

let mainWindow: BrowserWindow | null = null;
let mcProcess: MinecraftProcess | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Astro Launcher',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(import.meta.dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '..', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('get-api-url', () => API_URL);
  ipcMain.handle('get-launcher-key', () => getLauncherKey());
  ipcMain.handle('get-mc-dir', () => process.env.MC_DIR || join(process.env.APPDATA || '.', '.astro-launcher', 'minecraft'));
  ipcMain.handle('get-platform', () => process.platform);

  ipcMain.handle('mc:download', async (_event, versionName: string) => {
    mcProcess = new MinecraftProcess();
    mcProcess.onProgress = (msg, pct) => {
      mainWindow?.webContents.send('mc:progress', { msg, pct });
    };
    await mcProcess.downloadVersion(versionName);
    return true;
  });

  ipcMain.handle('mc:launch', async (_event, versionName: string, javaPath?: string) => {
    if (!mcProcess) mcProcess = new MinecraftProcess();
    mcProcess.onOutput = (line) => mainWindow?.webContents.send('mc:output', line);
    mcProcess.onError = (line) => mainWindow?.webContents.send('mc:error', line);
    mcProcess.onExit = (code) => mainWindow?.webContents.send('mc:exit', code);
    await mcProcess.launch(versionName, javaPath);
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

  ipcMain.handle('update:check', async (): Promise<UpdateInfo> => {
    return checkForUpdates();
  });

  ipcMain.handle('update:download', async (_event, url: string) => {
    const mainWin = mainWindow;
    const path = await downloadUpdate(url, (pct) => {
      mainWin?.webContents.send('update:progress', pct);
    });
    return path;
  });

  ipcMain.handle('update:install', async (_event, path: string) => {
    shell.openPath(path);
    app.quit();
    return true;
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
