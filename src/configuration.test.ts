import { expect, it } from "vitest";
import { buildConfiguration } from "./configuration";
import type { Plugin } from "./types";
const plugin = (
  id: string,
  capability: string,
  requires: string[] = [],
): Plugin => ({
  id,
  capability,
  requires,
  defaults: {},
  settings_schema: { type: "object" },
  contract: {},
});
it("adds shared named dependencies once and keeps arbitrary settings unchanged", () => {
  const plugins = [
    plugin("goal", "goal", ["backward_chain"]),
    plugin("backward_chain", "solver"),
    plugin("process", "process", ["gather-all"]),
    plugin("gather-all", "sequence"),
  ];
  const value = buildConfiguration(
    { request: { goal: { output: {} } } },
    new Set(["goal", "process"]),
    { process: '{"upstream_option":{"nested":42}}' },
    plugins,
  );
  expect(value.catalog.plugins.map((entry: any) => entry.use)).toEqual([
    "backward_chain",
    "gather-all",
    "goal",
    "process",
  ]);
  expect(
    value.catalog.plugins.find((entry: any) => entry.use === "process")
      .settings,
  ).toEqual({ upstream_option: { nested: 42 } });
  expect(value.catalog.solver.plugin).toBe("backward_chain");
});
it("rejects incompatible solver dependencies", () => {
  expect(() =>
    buildConfiguration({}, new Set(["goal", "other"]), {}, [
      plugin("goal", "goal", ["backward_chain"]),
      plugin("backward_chain", "solver"),
      plugin("other", "solver"),
    ]),
  ).toThrow("Only one solver");
});
