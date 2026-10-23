const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  shell,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Backend, runtimeDownload } = require("./backend.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window, backend;
app.whenReady().then(() => {
  const root = path.resolve(__dirname, "../dist");
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const file = path.resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (url.host !== "autostacgis" || !file.startsWith(root + path.sep))
      return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  const dev = process.env.AUTOSTACGIS_DEV_URL;
  if (dev && dev !== "http://127.0.0.1:5173")
    throw new Error("Unexpected development origin");
  backend = new Backend({
    bundle: app.isPackaged
      ? path.join(process.resourcesPath, "backend")
      : path.resolve(__dirname, "../resources/backend"),
    data: path.join(app.getPath("userData"), "backend"),
    log: (message) => window?.webContents.send("backend:log", message),
  });
  window = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#101a21",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.session.setPermissionRequestHandler((_, __, callback) =>
    callback(false),
  );
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== (dev || "app://autostacgis/")) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (["https:", "http:"].includes(new URL(url).protocol))
      shell.openExternal(url);
    return { action: "deny" };
  });
  const trusted = (event) => {
    if (
      event.sender !== window.webContents ||
      !event.senderFrame ||
      !event.senderFrame.url.startsWith(dev || "app://autostacgis/")
    )
      throw new Error("Untrusted IPC sender");
  };
  for (const method of ["status", "download", "start", "stop"])
    ipcMain.handle("backend:" + method, async (event) => {
      trusted(event);
      return backend[method]();
    });
  ipcMain.handle("backend:choose-input-directory", async (event) => {
    trusted(event);
    const result = await dialog.showOpenDialog(window, {
      title: "Choose input folder for the local backend",
      properties: ["openDirectory"],
    });
    return result.canceled
      ? null
      : backend.setInputDirectory(result.filePaths[0]);
  });
  ipcMain.handle("backend:download-runtime", async (event) => {
    trusted(event);
    let linuxFormat = "deb";
    if (process.platform === "linux") {
      if (process.arch !== "x64") {
        await shell.openExternal("https://docs.docker.com/engine/install/");
        return;
      }
      const choice = await dialog.showMessageBox(window, {
        type: "question",
        message:
          "Choose the Docker Desktop package for your Linux distribution",
        buttons: ["Ubuntu / Debian (.deb)", "Fedora / RHEL (.rpm)", "Cancel"],
        cancelId: 2,
      });
      if (choice.response === 2) return;
      linuxFormat = choice.response === 0 ? "deb" : "rpm";
    }
    const installer = runtimeDownload(
      process.platform,
      process.arch,
      linuxFormat,
    );
    const value = await dialog.showSaveDialog(window, {
      title: "Download Docker Desktop installer",
      defaultPath: path.join(app.getPath("downloads"), installer.name),
    });
    if (!value.canceled && value.filePath)
      await backend.downloadRuntime(
        value.filePath,
        (url) => net.fetch(url),
        linuxFormat,
      );
  });
  ipcMain.handle("backend:open-installer", async (event) => {
    trusted(event);
    if (!backend.installer)
      throw new Error("Download the runtime installer first");
    const error = await shell.openPath(backend.installer);
    if (error) throw new Error(error);
  });
  window.loadURL(dev || "app://autostacgis/");
});
app.on("window-all-closed", () => app.quit());
