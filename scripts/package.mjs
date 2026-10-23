import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
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
