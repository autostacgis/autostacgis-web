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

export const initialConfiguration = {
  solver: {
    backward_chain: {},
  },
  goal: {
    "metadata-value": {
      name: "mosaic",
      kind: "raster",
      path: "assets.$asset.data_state:mosaic",
      value: true,
      select: {
        kind: "raster",
        require: {
          "assets.$asset.data_state:spectral_sampling": "multispectral",
        },
      },
    },
  },
  process: {
    align_grid: {
      crs: "EPSG:6933",
    },
    extract_footprints: {},
    clean_footprints: {
      hole_edge_distance: 0,
      hole_to_hole_distance: 0,
      simplify_smoothing_radius: 0,
      simplify_tolerance: 0,
      filter_area_rank: null,
    },
    voronoi_seamlines: {},
    mask_by_polygons: {},
    mosaic: {},
  },
  execution: {
    steps: {
      project: {
        plugin: "align_grid",
      },
      footprints: {
        plugin: "extract_footprints",
        inputs: {
          images: "result:project:result",
        },
      },
      clean: {
        plugin: "clean_footprints",
        inputs: {
          vector: "result:footprints:result",
        },
      },
      seamlines: {
        plugin: "voronoi_seamlines",
        inputs: {
          footprints: "result:clean:result",
        },
      },
      mask: {
        plugin: "mask_by_polygons",
        inputs: {
          image: "result:project:result",
          mask: "result:seamlines:result",
        },
      },
      mosaic: {
        plugin: "mosaic",
        inputs: {
          images: "result:mask:result",
        },
      },
    },
  },
};
