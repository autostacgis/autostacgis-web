// Based on the fork's get-started-vite example; customizations stay outside upstream core.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const fork = resolve("external/kepler.gl/src");
const aliases =
  process.env.KEPLER_SOURCE !== "0" && existsSync(fork)
    ? readdirSync(fork).flatMap((name) => {
        const directory = resolve(fork, name);
        if (
          !existsSync(resolve(directory, "package.json")) ||
          !existsSync(resolve(directory, "src/index.ts"))
        )
          return [];
        const pkg = JSON.parse(
          readFileSync(resolve(directory, "package.json"), "utf8"),
        );
        return [
          {
            find: new RegExp(
              "^" + pkg.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
            ),
            replacement: resolve(directory, "src/index.ts"),
          },
        ];
      })
    : [];
export default defineConfig({
  base: "./",
  plugins: [wasm(), react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  resolve: {
    alias: aliases,
    dedupe: [
      "react",
      "react-dom",
      "styled-components",
      "@deck.gl/core",
      "@deck.gl/react",
      "@luma.gl/core",
      "@luma.gl/engine",
      "@luma.gl/webgl",
      "buffer",
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "production",
    ),
    "process.env.MapboxAccessToken": JSON.stringify(""),
    "process.env.NODE_DEBUG": "false",
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 2000,
    commonjsOptions: { transformMixedEsModules: true },
  },
  optimizeDeps: {
    exclude: ["parquet-wasm", "@loaders.gl/parquet"],
    include: ["buffer", "apache-arrow"],
  },
});
