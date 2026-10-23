import type { Json, Plugin } from "./types";
export function buildConfiguration(
  document: Json,
  selected: Set<string>,
  settings: Record<string, string>,
  plugins: Plugin[],
) {
  const definitions = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  const enabled = new Set(selected),
    pending = [...selected];
  while (pending.length) {
    const name = pending.pop()!;
    const plugin = definitions.get(name);
    if (!plugin) throw new Error(`Unavailable plugin ${name}`);
    for (const dependency of plugin.requires) {
      if (!enabled.has(dependency)) {
        enabled.add(dependency);
        pending.push(dependency);
      }
    }
  }
  const solvers = [...enabled].filter(
    (name) => definitions.get(name)?.capability === "solver",
  );
  if (solvers.length > 1)
    throw new Error(`Only one solver may be active: ${solvers.join(", ")}`);
  const catalog = {
    ...document.catalog,
    version: "1.0.0",
    plugins: [...enabled].sort().map((name) => ({
      use: name,
      settings: JSON.parse(
        settings[name] || JSON.stringify(definitions.get(name)?.defaults || {}),
      ),
    })),
  };
  if (solvers.length) catalog.solver = { plugin: solvers[0] };
  else delete catalog.solver;
  return { ...document, catalog };
}
