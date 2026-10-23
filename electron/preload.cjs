const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  update: (action) => ipcRenderer.invoke("updates:action", action),
  onUpdate: (callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  },
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
