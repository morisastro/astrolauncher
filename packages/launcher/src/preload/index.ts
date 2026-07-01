import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('astro', {
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  getLauncherKey: () => ipcRenderer.invoke('get-launcher-key'),
  getMcDir: () => ipcRenderer.invoke('get-mc-dir'),
  platform: process.platform,

  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },

  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (url: string) => ipcRenderer.invoke('update:download', url),
    install: (path: string) => ipcRenderer.invoke('update:install', path),
    onProgress: (cb: (pct: number) => void) => {
      ipcRenderer.on('update:progress', (_e, pct) => cb(pct));
    },
  },

  mc: {
    download: (version: string) => ipcRenderer.invoke('mc:download', version),
    launch: (version: string, javaPath?: string) => ipcRenderer.invoke('mc:launch', version, javaPath),
    kill: () => ipcRenderer.invoke('mc:kill'),
    status: () => ipcRenderer.invoke('mc:status'),
    onProgress: (cb: (data: { msg: string; pct: number }) => void) => {
      ipcRenderer.on('mc:progress', (_e, data) => cb(data));
    },
    onOutput: (cb: (line: string) => void) => {
      ipcRenderer.on('mc:output', (_e, line) => cb(line));
    },
    onError: (cb: (line: string) => void) => {
      ipcRenderer.on('mc:error', (_e, line) => cb(line));
    },
    onExit: (cb: (code: number) => void) => {
      ipcRenderer.on('mc:exit', (_e, code) => cb(code));
    },
  },
});
