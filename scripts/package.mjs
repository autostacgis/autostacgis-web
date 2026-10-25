import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const hash = createHash("sha256");
async function fingerprint(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await fingerprint(file);
    else {
      hash.update(file);
      hash.update(await readFile(file));
    }
  }
}
for (const directory of ["dist", "electron-dist", "resources/backend/wheels"])
  await fingerprint(directory);
const revision = hash.digest("hex").slice(0, 20),
  builtAt = new Date().toISOString();
args.push(
  `--config.extraMetadata.autostacgisBuild.revision=${revision}`,
  `--config.extraMetadata.autostacgisBuild.builtAt=${builtAt}`,
  `--config.releaseInfo.releaseName=AutostacGIS build ${revision}`,
);

const environment = { ...process.env };
// Local macOS builds remain launchable without consulting a developer keychain.
if (
  process.platform === "darwin" &&
  !environment.CSC_LINK &&
  !environment.CSC_NAME &&
  !args.some((arg) => arg.includes("mac.identity"))
) {
  args.push("--config.mac.identity=-", "--config.mac.hardenedRuntime=false");
  environment.CSC_IDENTITY_AUTO_DISCOVERY = "false";
}
const result = spawnSync(
  process.execPath,
  [require.resolve("electron-builder/cli.js"), ...args],
  { stdio: "inherit", env: environment },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
