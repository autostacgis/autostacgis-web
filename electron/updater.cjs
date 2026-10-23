const semver = require("semver");
const fs = require("node:fs/promises");
const path = require("node:path");
const backendFeed =
  "https://github.com/autostacgis/autostacgis-postgresql/releases/latest/download/backend-release.json";
class Updates {
  constructor({ app, backend, send, updater }) {
    const autoUpdater = (this.updater =
      updater || require("electron-updater").autoUpdater);
    this.app = app;
    this.backend = backend;
    this.send = send;
    this.state = { available: false, downloaded: false, backend: {} };
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on("update-available", (info) =>
      this.set({
        available: true,
        message: `AutostacGIS ${info.version} is available.`,
      }),
    );
    autoUpdater.on("update-not-available", () =>
      this.set({ available: false, message: "The app is up to date." }),
    );
    autoUpdater.on("download-progress", (value) =>
      this.set({
        message: `App update: ${Math.round(value.percent)}% downloaded.`,
      }),
    );
    autoUpdater.on("update-downloaded", () =>
      this.set({
        downloaded: true,
        message: "App update ready. Restart and install when ready.",
      }),
    );
    autoUpdater.on("error", (error) => this.set({ message: error.message }));
  }
  set(value) {
    this.state = { ...this.state, ...value };
    this.send(this.state);
    return this.state;
  }
  async action(action) {
    if (action === "check") {
      if (!this.app.isPackaged)
        return this.set({
          message: "App updates are available in a packaged release build.",
        });
      await this.updater.checkForUpdates();
    } else if (action === "download") {
      if (!this.state.available) throw Error("Check for an app update first");
      await this.updater.downloadUpdate();
    } else if (action === "install") {
      if (!this.state.downloaded) throw Error("Download the app update first");
      await this.backend.stop();
      setImmediate(() => this.updater.quitAndInstall(false, true));
    } else if (action === "backend-check") await this.checkBackend();
    else if (action === "backend-install") await this.installBackend();
    else throw Error("Unsupported update action");
    return this.state;
  }
  async checkBackend() {
    const response = await this.backend.fetcher(backendFeed);
    if (!response.ok)
      throw Error(`Backend release feed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (
      manifest.format_version !== 1 ||
      manifest.python !== "3.12" ||
      !semver.valid(manifest.version) ||
      !semver.valid(manifest.min_app_version) ||
      !Array.isArray(manifest.wheels) ||
      manifest.wheels.length !== 3
    )
      throw Error("Invalid backend release manifest");
    if (semver.lt(this.app.getVersion(), manifest.min_app_version))
      throw Error(
        `Update AutostacGIS to ${manifest.min_app_version} before this backend release`,
      );
    for (const wheel of manifest.wheels) {
      const url = new URL(wheel.url);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "github.com" ||
        !url.pathname.startsWith(
          "/autostacgis/autostacgis-postgresql/releases/download/",
        ) ||
        !/^[a-f0-9]{64}$/.test(wheel.sha256) ||
        !url.pathname.endsWith(".whl")
      )
        throw Error("Untrusted backend release asset");
    }
    const packages = new Set(
      manifest.wheels.map(
        (wheel) => path.basename(new URL(wheel.url).pathname).split("-")[0],
      ),
    );
    if (
      packages.size !== 3 ||
      !["autostacgis", "autostacgis_plugins", "autostacgis_postgresql"].every(
        (name) => packages.has(name),
      )
    )
      throw Error(
        "A backend release must contain the engine, plugins and service wheels",
      );
    this.release = manifest;
    const directory = await this.backend.wheelDirectory();
    const current =
      (await fs.readdir(directory))
        .find((name) => name.startsWith("autostacgis_postgresql-"))
        ?.split("-")[1] || "0.0.0";
    return this.set({
      backend: {
        available: semver.gt(manifest.version, current),
        version: manifest.version,
        message: semver.gt(manifest.version, current)
          ? `Backend ${manifest.version} is available.`
          : "The backend is up to date.",
      },
    });
  }
  async installBackend() {
    if (!this.release || !this.state.backend.available)
      throw Error("Check for a backend update first");
    if (!(await this.backend.status()).installed)
      throw Error("Download the embedded runtime first");
    if (this.backend.active)
      throw Error("A backend operation is already running");
    this.backend.active = true;
    const wasRunning = Boolean(this.backend.child),
      old = await this.backend.wheelDirectory();
    const directory = path.join(
      this.backend.data,
      "releases",
      this.release.version,
      "wheels",
    );
    try {
      await fs.mkdir(directory, { recursive: true });
      this.set({
        backend: {
          ...this.state.backend,
          message: "Downloading verified backend wheels…",
        },
      });
      for (const wheel of this.release.wheels) {
        const archive = await this.backend.archive(wheel, directory);
        await fs.copyFile(
          archive,
          path.join(directory, path.basename(new URL(wheel.url).pathname)),
        );
      }
      await this.backend.stop();
      try {
        await this.backend.installWheels(directory);
      } catch (error) {
        await this.backend.installWheels(old);
        this.backend.active = false;
        if (wasRunning) await this.backend.start();
        throw error;
      }
      await fs.writeFile(
        path.join(this.backend.data, "active-backend.json"),
        JSON.stringify({ directory, version: this.release.version }),
      );
      await fs.writeFile(
        path.join(this.backend.runtime, "ready.json"),
        JSON.stringify({ fingerprint: await this.backend.fingerprint() }),
      );
      this.backend.active = false;
      if (wasRunning) await this.backend.start();
      return this.set({
        backend: {
          available: false,
          version: this.release.version,
          message: `Backend ${this.release.version} installed.${wasRunning ? " The local API restarted." : ""}`,
        },
      });
    } finally {
      this.backend.active = false;
    }
  }
}
module.exports = { Updates };
