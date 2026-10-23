const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  chooseInputDirectory: () =>
    ipcRenderer.invoke("backend:choose-input-directory"),
  status: () => ipcRenderer.invoke("backend:status"),
  download: () => ipcRenderer.invoke("backend:download"),
  start: () => ipcRenderer.invoke("backend:start"),
  stop: () => ipcRenderer.invoke("backend:stop"),
  onLog: (callback) => {
    const listener = (_, message) => callback(String(message));
    ipcRenderer.on("backend:log", listener);
    return () => ipcRenderer.removeListener("backend:log", listener);
  },
});
