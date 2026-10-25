const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const manifest = require("./runtime-manifest.json");
function runtimeSpec(platform = process.platform, arch = process.arch) {
  const spec = manifest.targets[`${platform}-${arch}`];
  if (!spec)
    throw new Error(
      `The embedded backend is unavailable on ${platform}/${arch}; connect to a remote API.`,
    );
  return spec;
}
function nativeEnvironment() {
  const env = {
    ...process.env,
    PYTHONNOUSERSITE: "1",
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
    UV_NO_CONFIG: "1",
    UV_SYSTEM_CERTS: "true",
  };
  delete env.PYTHONHOME;
  delete env.PYTHONPATH;
  return env;
}
class Backend {
  constructor({ bundle, data, log = () => {}, fetcher = fetch }) {
    this.bundle = bundle;
    this.data = data;
    this.log = log;
    this.fetcher = fetcher;
    this.runtime = path.join(data, "runtime");
    this.python = path.join(
      this.runtime,
      "venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    this.postgres = path.join(this.runtime, "postgres");
    this.active = false;
    this.child = null;
    this.connection = null;
    this.secrets = [];
  }
  async environment() {
    await fs.mkdir(this.data, { recursive: true, mode: 0o700 });
    const file = path.join(this.data, "credentials.json");
    try {
      await fs.writeFile(
        file,
        JSON.stringify({
          databasePassword: crypto.randomBytes(32).toString("hex"),
          token: crypto.randomBytes(32).toString("hex"),
        }),
        { mode: 0o600, flag: "wx" },
      );
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const credentials = JSON.parse(await fs.readFile(file, "utf8"));
    this.secrets = [credentials.databasePassword, credentials.token].filter(
      Boolean,
    );
    return { file, credentials };
  }
  emit(chunk) {
    let text = String(chunk);
    for (const secret of this.secrets)
      text = text.split(secret).join("[redacted]");
    this.log(text);
  }
  async setInputDirectory(directory) {
    if (!(await fs.stat(directory)).isDirectory())
      throw new Error("Choose a valid input directory");
    await this.environment();
    await fs.writeFile(
      path.join(this.data, "input-directory.json"),
      JSON.stringify(directory),
      { mode: 0o600 },
    );
    return directory;
  }
  async run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        shell: false,
        windowsHide: true,
        env: nativeEnvironment(),
        ...options,
      });
      let output = "";
      const emit = (chunk) => {
        output = (output + chunk).slice(-12000);
        this.emit(chunk);
      };
      child.stdout.on("data", emit);
      child.stderr.on("data", emit);
      child.once("error", reject);
      child.once("close", (code) =>
        code === 0
          ? resolve(output)
          : reject(
              new Error(output || `${path.basename(command)} exited ${code}`),
            ),
      );
    });
  }
  async wheelDirectory() {
    try {
      const value = JSON.parse(
        await fs.readFile(path.join(this.data, "active-backend.json"), "utf8"),
      );
      const directory = path.resolve(value.directory);
      if (!directory.startsWith(path.resolve(this.data, "releases") + path.sep))
        throw Error("Invalid backend release directory");
      return directory;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return path.join(this.bundle, "wheels");
    }
  }
  uvPath() {
    return path.join(
      this.runtime,
      "bootstrap",
      runtimeSpec().uvDirectory,
      "uv" + (process.platform === "win32" ? ".exe" : ""),
    );
  }
  async installWheels(directory) {
    const wheels = (await fs.readdir(directory))
      .filter((name) => name.endsWith(".whl"))
      .map((name) => path.join(directory, name));
    await this.run(this.uvPath(), [
      "pip",
      "install",
      "--python",
      this.python,
      "--reinstall-package",
      "autostacgis",
      "--reinstall-package",
      "autostacgis-plugins",
      "--reinstall-package",
      "autostacgis-postgresql",
      ...wheels,
    ]);
  }
  async fingerprint() {
    const hash = crypto.createHash("sha256").update(JSON.stringify(manifest));
    for (const name of (await fs.readdir(await this.wheelDirectory()))
      .filter((name) => name.endsWith(".whl"))
      .sort())
      hash.update(
        await fs.readFile(path.join(await this.wheelDirectory(), name)),
      );
    return hash.digest("hex");
  }
  async status() {
    try {
      const marker = JSON.parse(
        await fs.readFile(path.join(this.runtime, "ready.json"), "utf8"),
      );
      await fs.access(this.python);
      await fs.access(
        path.join(
          this.postgres,
          "bin",
          "postgres" + (process.platform === "win32" ? ".exe" : ""),
        ),
      );
      const installed = marker.fingerprint === (await this.fingerprint());
      return {
        installed,
        running: Boolean(this.child && this.child.exitCode === null),
        ...(this.connection || {}),
        message: installed
          ? "Embedded backend ready"
          : "Download the updated embedded backend",
      };
    } catch {
      return {
        installed: false,
        running: false,
        message: "Download the embedded backend",
      };
    }
  }
  async archive(asset, destination) {
    const cache = path.join(this.data, "downloads");
    await fs.mkdir(cache, { recursive: true });
    const archive = path.join(
      cache,
      path.basename(new URL(asset.url).pathname),
    );
    let valid = false;
    try {
      valid =
        crypto
          .createHash("sha256")
          .update(await fs.readFile(archive))
          .digest("hex") === asset.sha256;
    } catch {}
    if (!valid) {
      this.emit("Downloading " + path.basename(archive) + "\n");
      const response = await this.fetcher(asset.url);
      if (!response.ok || !response.body)
        throw new Error(`Download failed (${response.status})`);
      const temporary = archive + "." + crypto.randomUUID() + ".download";
      try {
        await pipeline(
          Readable.fromWeb(response.body),
          require("node:fs").createWriteStream(temporary, { flags: "wx" }),
        );
        if (
          crypto
            .createHash("sha256")
            .update(await fs.readFile(temporary))
            .digest("hex") !== asset.sha256
        )
          throw new Error("Runtime checksum verification failed");
        await fs.rename(temporary, archive);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    await fs.mkdir(destination, { recursive: true });
    return archive;
  }
  async download() {
    if (this.active || this.child)
      throw new Error("Stop the embedded backend before downloading an update");
    this.active = true;
    try {
      const spec = runtimeSpec();
      await this.environment();
      const uvDirectory = path.join(this.runtime, "bootstrap");
      const uvArchive = await this.archive(spec.uv, uvDirectory);
      await this.run(process.platform === "win32" ? "tar.exe" : "tar", [
        "-xf",
        uvArchive,
        "-C",
        uvDirectory,
      ]);
      const uv = path.join(
        uvDirectory,
        spec.uvDirectory,
        "uv" + (process.platform === "win32" ? ".exe" : ""),
      );
      const env = {
        ...nativeEnvironment(),
        UV_PYTHON_INSTALL_DIR: path.join(this.runtime, "python"),
        UV_CACHE_DIR: path.join(this.runtime, "cache"),
      };
      await this.run(
        uv,
        [
          "venv",
          "--allow-existing",
          "--python",
          manifest.python,
          "--managed-python",
          path.join(this.runtime, "venv"),
        ],
        { env },
      );
      const pgArchive = await this.archive(spec.postgres, this.postgres);
      await this.run(this.python, [
        "-c",
        "import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2],filter='data')",
        pgArchive,
        this.postgres,
      ]);
      const wheelDirectory = await this.wheelDirectory();
      const wheels = (await fs.readdir(wheelDirectory))
        .filter((name) => name.endsWith(".whl"))
        .map((name) => path.join(wheelDirectory, name));
      await this.run(
        uv,
        [
          "pip",
          "install",
          "--python",
          this.python,
          "--reinstall-package",
          "autostacgis",
          "--reinstall-package",
          "autostacgis-plugins",
          "--reinstall-package",
          "autostacgis-postgresql",
          ...wheels,
        ],
        { env },
      );
      const extensions = await this.archive(spec.extensions, this.postgres);
      await this.run(this.python, [
        "-m",
        "autostacgis_postgresql.install_extensions",
        extensions,
        this.postgres,
      ]);
      await fs.writeFile(
        path.join(this.runtime, "ready.json"),
        JSON.stringify({ fingerprint: await this.fingerprint() }),
      );
      this.emit(
        "Embedded backend downloaded. It starts only when you choose Start and connect.\n",
      );
      return await this.status();
    } finally {
      this.active = false;
    }
  }
  async start() {
    if (this.child && this.connection) return this.status();
    if (this.active) throw new Error("A backend operation is already running");
    this.active = true;
    try {
      if (!(await this.status()).installed)
        throw new Error("Download the embedded backend first");
      const { credentials } = await this.environment();
      const child = spawn(
        this.python,
        [
          "-m",
          "autostacgis_postgresql.embedded",
          "--postgres-root",
          this.postgres,
          "--directory",
          path.join(this.data, "store"),
        ],
        {
          shell: false,
          windowsHide: true,
          env: {
            ...nativeEnvironment(),
            AUTOSTACGIS_UV: this.uvPath(),
            AUTOSTACGIS_DATABASE_PASSWORD: credentials.databasePassword,
            AUTOSTACGIS_API_TOKEN: credentials.token,
          },
        },
      );
      this.child = child;
      child.stderr.on("data", (chunk) => this.emit(chunk));
      const connection = await new Promise((resolve, reject) => {
        let buffer = "";
        const timer = setTimeout(
          () =>
            reject(
              new Error("Embedded startup timed out; check the backend logs"),
            ),
          120000,
        );
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          this.child = null;
          this.connection = null;
          reject(
            new Error(`Embedded backend exited (${code}); check its logs`),
          );
        });
        child.stdout.on("data", (chunk) => {
          buffer += chunk;
          while (buffer.includes("\n")) {
            const index = buffer.indexOf("\n"),
              line = buffer.slice(0, index);
            buffer = buffer.slice(index + 1);
            if (line.startsWith("AUTOSTACGIS_READY:")) {
              clearTimeout(timer);
              resolve({
                ...JSON.parse(line.slice("AUTOSTACGIS_READY:".length)),
                token: credentials.token,
              });
            } else this.emit(line + "\n");
          }
        });
      });
      this.connection = connection;
      return await this.status();
    } catch (error) {
      await this.stop();
      throw error;
    } finally {
      this.active = false;
    }
  }
  async stop() {
    const child = this.child;
    if (!child) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => child.kill(), 60000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      if (child.exitCode !== null) {
        clearTimeout(timer);
        resolve();
        return;
      }
      child.stdin.on("error", () => {});
      child.stdin.end("stop\n");
    });
    this.child = null;
    this.connection = null;
    this.emit("Embedded backend stopped. Database and results are retained.\n");
  }
}
module.exports = { Backend, runtimeSpec, nativeEnvironment };
