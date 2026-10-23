import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
it("does not create a pool, invoke Docker, or write credentials until explicitly requested", async () => {
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
    const first = await backend.environment();
    const second = await backend.environment();
    expect(first.env.AUTOSTACGIS_API_TOKEN).toMatch(/^[a-f0-9]{64}$/);
    expect(second.env).toEqual(first.env);
    expect(await readFile(first.file, "utf8")).not.toContain("replace-with");
    expect(spawn).not.toHaveBeenCalled();
  } finally {
    spawn.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});

it("selects official runtime downloads for each supported desktop platform", () => {
  const { runtimeDownload } = require("./backend.cjs");
  expect(runtimeDownload("darwin", "arm64").url).toContain("/mac/main/arm64/");
  expect(runtimeDownload("win32", "x64").url).toContain("/win/main/amd64/");
  expect(runtimeDownload("linux", "x64", "deb").name).toBe(
    "docker-desktop-amd64.deb",
  );
  expect(runtimeDownload("linux", "x64", "rpm").name).toBe(
    "docker-desktop-x86_64.rpm",
  );
  expect(() => runtimeDownload("linux", "arm64")).toThrow("Docker Engine");
});

it("finds Docker even when a GUI launch has a minimal PATH", async () => {
  const fs = require("node:fs/promises");
  const access = vi.spyOn(fs, "access").mockResolvedValue(undefined);
  try {
    const { dockerExecutable } = require("./backend.cjs");
    expect(await dockerExecutable()).not.toBe("docker");
    expect(access).toHaveBeenCalled();
  } finally {
    access.mockRestore();
  }
});
