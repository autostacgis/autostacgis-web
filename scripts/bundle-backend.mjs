import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const source = path.resolve(
  process.env.AUTOSTACGIS_BACKEND_SOURCE || "../autostacgis-postgresql",
);
const target = path.resolve("resources/backend");
const python = process.env.PYTHON || "python3";
const result = spawnSync(
  python,
  [path.join(source, "scripts/build_engine_wheels.py")],
  { stdio: "inherit" },
);
if (result.status !== 0)
  throw new Error("Build engine wheels before packaging the backend");
const serviceWheel = spawnSync(
  python,
  ["-m", "build", "--wheel", "--outdir", path.join(source, "wheels"), source],
  { stdio: "inherit" },
);
if (serviceWheel.status !== 0)
  throw new Error("Build the native service wheel before packaging");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const name of ["src", "wheels", "pyproject.toml", "README.md", "LICENSE"])
  await cp(path.join(source, name), path.join(target, name), {
    recursive: true,
  });
console.log(
  "Bundled backend source and engine wheels:",
  await readdir(path.join(target, "wheels")),
);
