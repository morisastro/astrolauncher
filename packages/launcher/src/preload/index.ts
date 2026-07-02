const { contextBridge, ipcRenderer } = require('electron');

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
    download: (url) => ipcRenderer.invoke('update:download', url),
    install: (path) => ipcRenderer.invoke('update:install', path),
    onProgress: (cb) => {
      ipcRenderer.on('update:progress', (_e, pct) => cb(pct));
    },
  },

  mc: {
    download: (version) => ipcRenderer.invoke('mc:download', version),
    launch: (version, javaPath) => ipcRenderer.invoke('mc:launch', version, javaPath),
    kill: () => ipcRenderer.invoke('mc:kill'),
    status: () => ipcRenderer.invoke('mc:status'),
    onProgress: (cb) => {
      ipcRenderer.on('mc:progress', (_e, data) => cb(data));
    },
    onOutput: (cb) => {
      ipcRenderer.on('mc:output', (_e, line) => cb(line));
    },
    onError: (cb) => {
      ipcRenderer.on('mc:error', (_e, line) => cb(line));
    },
    onExit: (cb) => {
      ipcRenderer.on('mc:exit', (_e, code) => cb(code));
    },
  },

  mod: {
    search: (query, limit, loader, mcVersion) => ipcRenderer.invoke('mod:search', query, limit, loader, mcVersion),
    versions: (modId) => ipcRenderer.invoke('mod:versions', modId),
    download: (modId, versionId) => ipcRenderer.invoke('mod:download', modId, versionId),
    onProgress: (cb) => {
      ipcRenderer.on('mod:progress', (_e, data) => cb(data));
    },
  },
});
