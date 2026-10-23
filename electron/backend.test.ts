import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
it("does not download, launch a service, or write credentials until requested", async () => {
  const cp = require("node:child_process");
  const spawn = vi.spyOn(cp, "spawn");
  const { Backend } = require("./backend.cjs");
  const directory = await mkdtemp(
    path.join(tmpdir(), "autostacgis-backend-test-"),
  );
  try {
    const backend = new Backend({
      bundle: directory,
      data: path.join(directory, "data"),
    });
    expect(spawn).not.toHaveBeenCalled();
    await expect(stat(path.join(directory, "data"))).rejects.toThrow();
    const status = await backend.status();
    expect(status).toMatchObject({ installed: false, running: false });
    expect(spawn).not.toHaveBeenCalled();
    const first = await backend.environment();
    const second = await backend.environment();
    expect(first.credentials.token).toMatch(/^[a-f0-9]{64}$/);
    expect(second.credentials).toEqual(first.credentials);
    expect(await readFile(first.file, "utf8")).not.toContain("replace-with");
    await expect(backend.start()).rejects.toThrow(
      "Download the embedded backend first",
    );
    expect(spawn).not.toHaveBeenCalled();
  } finally {
    spawn.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
it("pins verified native PostgreSQL, contrib, and Python bootstrap bundles on supported platforms", () => {
  const { runtimeSpec } = require("./backend.cjs");
  for (const [platform, arch] of [
    ["darwin", "arm64"],
    ["darwin", "x64"],
    ["win32", "x64"],
    ["linux", "x64"],
    ["linux", "arm64"],
  ]) {
    const spec = runtimeSpec(platform, arch);
    for (const asset of [spec.postgres, spec.uv, spec.extensions]) {
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(asset.url).toMatch(/^https:/);
    }
  }
  expect(() => runtimeSpec("win32", "arm64")).toThrow("remote API");
});
it("isolates the embedded interpreter from host Python configuration", () => {
  const { nativeEnvironment } = require("./backend.cjs");
  const env = nativeEnvironment();
  expect(env.PYTHONPATH).toBeUndefined();
  expect(env.PYTHONHOME).toBeUndefined();
  expect(env.PYTHONNOUSERSITE).toBe("1");
});
it("verifies downloaded bytes before accepting a runtime or backend asset", async () => {
  const { createHash } = await import("node:crypto");
  const { Backend } = require("./backend.cjs");
  const directory = await mkdtemp(path.join(tmpdir(), "autostacgis-checksum-"));
  try {
    const content = Buffer.from("verified wheel bytes");
    const backend = new Backend({
      bundle: directory,
      data: directory,
      fetcher: async () => new Response(content),
    });
    const asset = {
      url: "https://example.com/release.whl",
      sha256: createHash("sha256").update(content).digest("hex"),
    };
    const file = await backend.archive(asset, directory);
    expect(await readFile(file)).toEqual(content);
    await expect(
      backend.archive({ ...asset, sha256: "0".repeat(64) }, directory),
    ).rejects.toThrow("checksum");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
