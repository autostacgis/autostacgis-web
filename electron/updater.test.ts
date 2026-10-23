import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const { Updates } = require("./updater.cjs");
function fakeUpdater() {
  return Object.assign(new EventEmitter(), {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  });
}
it("downloads app updates only on request and stops the backend before installing", async () => {
  const updater = fakeUpdater(),
    backend = { stop: vi.fn() },
    updates = new Updates({
      app: { isPackaged: true },
      backend,
      updater,
      send: vi.fn(),
    });
  expect((updater as any).autoDownload).toBe(false);
  await updates.action("check");
  expect(updater.checkForUpdates).toHaveBeenCalledOnce();
  expect(updater.downloadUpdate).not.toHaveBeenCalled();
  updater.emit("update-available", { version: "0.3.0" });
  await updates.action("download");
  expect(updater.downloadUpdate).toHaveBeenCalledOnce();
  updater.emit("update-downloaded");
  await updates.action("install");
  await new Promise((resolve) => setImmediate(resolve));
  expect(backend.stop).toHaveBeenCalledOnce();
  expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
});
it("checks backend compatibility and rejects assets outside the release repository", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "autostacgis-update-"));
  try {
    await writeFile(
      path.join(directory, "autostacgis_postgresql-0.2.0-py3-none-any.whl"),
      "",
    );
    const manifest = {
      format_version: 1,
      python: "3.12",
      version: "0.3.0",
      min_app_version: "0.2.0",
      wheels: [
        "autostacgis",
        "autostacgis_plugins",
        "autostacgis_postgresql",
      ].map((name) => ({
        url: `https://github.com/autostacgis/autostacgis-postgresql/releases/download/v0.3.0/${name}-0.3.0-py3-none-any.whl`,
        sha256: "a".repeat(64),
      })),
    };
    const backend = {
      fetcher: async () => ({ ok: true, json: async () => manifest }),
      wheelDirectory: async () => directory,
    };
    const updates = new Updates({
      app: { getVersion: () => "0.2.0" },
      backend,
      send: vi.fn(),
      updater: fakeUpdater(),
    });
    await updates.action("backend-check");
    expect(updates.state.backend.available).toBe(true);
    manifest.min_app_version = "0.4.0";
    await expect(updates.action("backend-check")).rejects.toThrow(
      "Update AutostacGIS",
    );
    manifest.min_app_version = "0.2.0";
    manifest.wheels[0].url = "https://example.com/untrusted.whl";
    await expect(updates.action("backend-check")).rejects.toThrow("Untrusted");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it.each([false, true])(
  "preserves backend state and restarts after update (installation failure: %s)",
  async (fail) => {
    const { mkdir, readFile } = await import("node:fs/promises");
    const directory = await mkdtemp(
      path.join(tmpdir(), "autostacgis-apply-update-"),
    );
    try {
      const runtime = path.join(directory, "runtime"),
        old = path.join(directory, "old");
      await mkdir(runtime);
      await mkdir(old);
      const backend: any = {
        data: directory,
        runtime,
        active: false,
        child: {},
        status: async () => ({ installed: true }),
        wheelDirectory: async () => old,
        fingerprint: async () => "new-fingerprint",
        installWheels: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(async () => {
          backend.child = null;
        }),
        start: vi.fn(async () => {
          backend.child = {};
        }),
        archive: async (wheel: any) => {
          const file = path.join(
            directory,
            path.basename(new URL(wheel.url).pathname),
          );
          await writeFile(file, "verified");
          return file;
        },
      };
      if (fail)
        backend.installWheels.mockRejectedValueOnce(
          Error("installation failed"),
        );
      const updates = new Updates({
        app: {},
        backend,
        send: vi.fn(),
        updater: fakeUpdater(),
      });
      updates.release = {
        version: "0.3.0",
        wheels: [
          "autostacgis",
          "autostacgis_plugins",
          "autostacgis_postgresql",
        ].map((name) => ({
          url: `https://github.com/autostacgis/autostacgis-postgresql/releases/download/v0.3.0/${name}-0.3.0-py3-none-any.whl`,
          sha256: "a".repeat(64),
        })),
      };
      updates.state.backend.available = true;
      if (fail) {
        await expect(updates.action("backend-install")).rejects.toThrow(
          "installation failed",
        );
        expect(backend.installWheels).toHaveBeenLastCalledWith(old);
        await expect(
          readFile(path.join(directory, "active-backend.json")),
        ).rejects.toThrow();
      } else {
        await updates.action("backend-install");
        expect(
          JSON.parse(
            await readFile(path.join(directory, "active-backend.json"), "utf8"),
          ).version,
        ).toBe("0.3.0");
      }
      expect(backend.start).toHaveBeenCalledOnce();
      expect(backend.active).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
