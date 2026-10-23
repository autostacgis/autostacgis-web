import { build } from "esbuild";
import fs from "node:fs/promises";
await fs.mkdir("electron-dist", { recursive: true });
await build({
  entryPoints: ["electron/main.cjs"],
  outfile: "electron-dist/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  define: { "process.env.NODE_ENV": '"production"' },
});
await fs.copyFile("electron/preload.cjs", "electron-dist/preload.cjs");
