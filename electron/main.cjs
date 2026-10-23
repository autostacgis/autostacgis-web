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
const { Updates } = require("./updater.cjs");
const { Backend } = require("./backend.cjs");
app.setName("AutostacGIS");
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
    fetcher: (url) => net.fetch(url),
    log: (message) => window?.webContents.send("backend:log", message),
  });
  window = new BrowserWindow({
    title: "AutostacGIS",
    icon: path.resolve(__dirname, "../assets/icons/icon.png"),
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
  const updates = new Updates({
    app,
    backend,
    send: (value) => window?.webContents.send("updates:state", value),
  });
  ipcMain.handle("updates:action", async (event, action) => {
    trusted(event);
    return updates.action(action);
  });
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
  window.loadURL(dev || "app://autostacgis/");
});
let closing = false;
app.on("before-quit", (event) => {
  if (!closing && backend?.child) {
    event.preventDefault();
    closing = true;
    backend.stop().finally(() => app.quit());
  }
});
app.on("window-all-closed", () => app.quit());
