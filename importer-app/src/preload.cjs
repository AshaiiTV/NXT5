const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nxt5", {
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  getClientStatus: () => ipcRenderer.invoke("get-client-status"),
  chooseLeaguePath: () => ipcRenderer.invoke("choose-league-path"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  generateImport: (form) => ipcRenderer.invoke("generate-import", form),
  cancelImport: () => ipcRenderer.invoke("cancel-import"),
  showExport: (id) => ipcRenderer.invoke("show-export", id),
  onProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("import-progress", listener);
    return () => ipcRenderer.removeListener("import-progress", listener);
  },
  checkUpdate: () => ipcRenderer.invoke("check-update"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  collector: {
    state: () => ipcRenderer.invoke("collector-state"),
    connect: (form) => ipcRenderer.invoke("collector-connect", form),
    verify: () => ipcRenderer.invoke("collector-verify"),
    forget: () => ipcRenderer.invoke("collector-forget"),
    start: () => ipcRenderer.invoke("collector-start"),
    stop: () => ipcRenderer.invoke("collector-stop"),
    submit: (gameId) => ipcRenderer.invoke("collector-submit", gameId),
    retry: (gameId) => ipcRenderer.invoke("collector-retry", gameId),
    onUpdate: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, snapshot) => callback(snapshot);
      ipcRenderer.on("collector-update", listener);
      return () => ipcRenderer.removeListener("collector-update", listener);
    },
  },
});
