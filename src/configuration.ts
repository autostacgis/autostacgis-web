import type { Json, Plugin } from "./types";
export function buildConfiguration(
  document: Json,
  selected: Set<string>,
  settings: Record<string, string>,
  plugins: Plugin[],
) {
  const result = structuredClone(document),
    definitions = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  for (const capability of new Set(
    plugins.map((plugin) => plugin.capability),
  )) {
    for (const name of Object.keys(document[capability] || {})) {
      if (definitions.get(name)?.capability !== capability)
        throw new Error(`Unavailable ${capability} plugin ${name}`);
    }
  }
  for (const plugin of plugins) delete result[plugin.capability];
  delete result.catalog;
  delete result.request;
  const enabled = new Set(selected),
    pending = [...selected];
  while (pending.length) {
    const name = pending.pop()!,
      plugin = definitions.get(name);
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
  if (solvers.length > 1) throw new Error("Only one solver may be active");
  for (const name of selected) {
    const plugin = definitions.get(name);
    if (!plugin) throw new Error(`Unavailable plugin ${name}`);
    (result[plugin.capability] ||= {})[name] = JSON.parse(
      settings[name] || JSON.stringify(plugin.defaults || {}),
    );
  }
  if (solvers.length && !result.solver) result.solver = { [solvers[0]]: {} };
  return result;
}
