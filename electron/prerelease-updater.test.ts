import { expect, it } from "vitest";
import { createRequire } from "node:module";
const { prereleaseUpdater } = createRequire(import.meta.url)(
  "./prerelease-updater.cjs",
);
it("offers changed 0.0.1 builds while retaining platform and rollout checks", async () => {
  class Updater {
    currentVersion = { version: "0.0.1" };
    supported = true;
    rollout = true;
    async isUpdateAvailable() {
      return false;
    }
    async isUpdateSupported() {
      return this.supported;
    }
    async isUserWithinRollout() {
      return this.rollout;
    }
  }
  const updater = prereleaseUpdater(Updater, {
    revision: "a".repeat(20),
    builtAt: "2026-10-24T00:00:00Z",
  });
  const info = {
    version: "0.0.1",
    releaseName: `AutostacGIS build ${"b".repeat(20)}`,
    releaseDate: "2026-10-25T00:00:00Z",
  };
  expect(await updater.isUpdateAvailable(info)).toBe(true);
  expect(
    await updater.isUpdateAvailable({
      ...info,
      releaseDate: "2026-10-23T00:00:00Z",
    }),
  ).toBe(false);
  expect(
    await updater.isUpdateAvailable({
      ...info,
      releaseName: `AutostacGIS build ${"a".repeat(20)}`,
    }),
  ).toBe(false);
  updater.supported = false;
  expect(await updater.isUpdateAvailable(info)).toBe(false);
  updater.supported = true;
  updater.rollout = false;
  expect(await updater.isUpdateAvailable(info)).toBe(false);
});
