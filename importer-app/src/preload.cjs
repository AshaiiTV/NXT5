const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nxt5', {
  generateImport: (form) => ipcRenderer.invoke('generate-import', form),
  updateImport: (payload) => ipcRenderer.invoke('update-import', payload),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
