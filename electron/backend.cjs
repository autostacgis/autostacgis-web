const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
async function dockerExecutable() {
  // GUI launchers frequently omit these locations from PATH.
  const candidates =
    process.platform === "darwin"
      ? [
          "/usr/local/bin/docker",
          "/opt/homebrew/bin/docker",
          "/Applications/Docker.app/Contents/Resources/bin/docker",
        ]
      : process.platform === "win32"
        ? [
            path.join(
              process.env.ProgramFiles || "C:\\Program Files",
              "Docker",
              "Docker",
              "resources",
              "bin",
              "docker.exe",
            ),
          ]
        : [
            "/usr/bin/docker",
            "/usr/local/bin/docker",
            "/opt/docker-desktop/bin/docker",
          ];
  for (const candidate of candidates) {
    try {
      await fs.access(
        candidate,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
      return candidate;
    } catch {
      /* Try the next standard installation. */
    }
  }
  return "docker";
}
function runtimeDownload(platform, arch, linuxFormat = "deb") {
  if (platform === "darwin")
    return {
      name: "Docker.dmg",
      url: `https://desktop.docker.com/mac/main/${arch === "arm64" ? "arm64" : "amd64"}/Docker.dmg`,
    };
  if (platform === "win32")
    return {
      name: "Docker Desktop Installer.exe",
      url: `https://desktop.docker.com/win/main/${arch === "arm64" ? "arm64" : "amd64"}/Docker%20Desktop%20Installer.exe`,
    };
  if (
    platform === "linux" &&
    arch === "x64" &&
    ["deb", "rpm"].includes(linuxFormat)
  ) {
    const name =
      linuxFormat === "deb"
        ? "docker-desktop-amd64.deb"
        : "docker-desktop-x86_64.rpm";
    return { name, url: `https://desktop.docker.com/linux/main/amd64/${name}` };
  }
  throw new Error(
    "Install Docker Engine and Compose using your distribution's package manager",
  );
}
class Backend {
  constructor({ bundle, data, log = () => {} }) {
    this.bundle = bundle;
    this.data = data;
    this.log = log;
    this.active = false;
    this.installer = null;
    this.secrets = [];
  }
  async environment() {
    await fs.mkdir(this.data, { recursive: true });
    const incoming = path.join(this.data, "incoming");
    await fs.mkdir(incoming, { recursive: true });
    const file = path.join(this.data, ".env");
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(
        file,
        `POSTGRES_PASSWORD=${crypto.randomBytes(32).toString("hex")}\nAUTOSTACGIS_API_TOKEN=${crypto.randomBytes(32).toString("hex")}\nAUTOSTACGIS_PUBLIC_URL=http://127.0.0.1:8080\nAUTOSTACGIS_PORT=8080\nAUTOSTACGIS_INPUT_DIRECTORY=${JSON.stringify(incoming)}\n`,
        { mode: 0o600, flag: "wx" },
      );
    }
    const text = await fs.readFile(file, "utf8");
    const env = Object.fromEntries(
      text
        .trim()
        .split("\n")
        .map((line) => {
          const index = line.indexOf("=");
          const value = line.slice(index + 1);
          return [
            line.slice(0, index),
            value.startsWith('"') ? JSON.parse(value) : value,
          ];
        }),
    );
    this.secrets = [env.POSTGRES_PASSWORD, env.AUTOSTACGIS_API_TOKEN].filter(
      Boolean,
    );
    return { file, env };
  }
  async setInputDirectory(directory) {
    if (
      directory.includes("\n") ||
      directory.includes("\r") ||
      !(await fs.stat(directory)).isDirectory()
    )
      throw new Error("Choose a valid input directory");
    const { file, env } = await this.environment();
    env.AUTOSTACGIS_INPUT_DIRECTORY = directory;
    await fs.writeFile(
      file,
      Object.entries(env)
        .map(
          ([name, value]) =>
            `${name}=${name === "AUTOSTACGIS_INPUT_DIRECTORY" ? JSON.stringify(value) : value}`,
        )
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    return directory;
  }
  async run(args, { allowFailure = false } = {}) {
    if (this.active)
      throw new Error("Another backend operation is already running");
    this.active = true;
    try {
      const executable = await dockerExecutable();
      return await new Promise((resolve, reject) => {
        const child = spawn(executable, args, {
          cwd: this.bundle,
          shell: false,
          windowsHide: true,
        });
        let output = "";
        const emit = (chunk) => {
          let text = chunk.toString();
          for (const secret of this.secrets)
            text = text.split(secret).join("[redacted]");
          output = (output + text).slice(-60000);
          this.log(text);
        };
        child.stdout.on("data", emit);
        child.stderr.on("data", emit);
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 || allowFailure
            ? resolve(output)
            : reject(new Error(output || `Docker exited ${code}`)),
        );
      });
    } finally {
      this.active = false;
    }
  }
  async compose(args) {
    const { file } = await this.environment();
    return this.run([
      "compose",
      "--project-name",
      "autostacgis-desktop",
      "--env-file",
      file,
      "--file",
      path.join(this.bundle, "compose.yaml"),
      ...args,
    ]);
  }
  async status() {
    try {
      await this.run(["version", "--format", "{{.Server.Version}}"]);
      const output = await this.compose(["ps", "--format", "json"]);
      return {
        installed: true,
        running: output.includes("running"),
        message: "Docker is ready. Backend startup is always explicit.",
      };
    } catch (error) {
      return { installed: false, running: false, message: String(error) };
    }
  }
  async download() {
    await this.compose(["pull", "--ignore-buildable"]);
    await this.compose(["build"]);
  }
  async start() {
    await this.compose(["up", "--build", "--detach", "--wait"]);
    const { env } = await this.environment();
    return {
      installed: true,
      running: true,
      url: env.AUTOSTACGIS_PUBLIC_URL,
      token: env.AUTOSTACGIS_API_TOKEN,
    };
  }
  async stop() {
    await this.compose(["down"]);
  }
  async downloadRuntime(destination, fetcher = fetch, linuxFormat = "deb") {
    const { url } = runtimeDownload(
      process.platform,
      process.arch,
      linuxFormat,
    );
    const response = await fetcher(url);
    if (!response.ok || !response.body)
      throw new Error("Runtime download failed: " + response.status);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temp = destination + "." + crypto.randomUUID() + ".download";
    try {
      const stream = require("node:fs").createWriteStream(temp, {
        flags: "wx",
      });
      await pipeline(Readable.fromWeb(response.body), stream);
      await fs.rename(temp, destination);
      this.installer = destination;
      this.log("Runtime installer downloaded. Open it to finish installation.");
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
}
module.exports = { Backend, runtimeDownload, dockerExecutable };
