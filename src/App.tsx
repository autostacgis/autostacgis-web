import { useEffect, useState } from "react";
import Map, { addGeojson, addRaster } from "./Map";
import PluginSettings from "./PluginSettings";
import { Api, assetHref, nextPage, resolveItem } from "./api";
import { buildConfiguration } from "./configuration";
import type { BackendStatus, Descriptor, Job, Json } from "./types";
const empty = {
  catalog: { version: "1.0.0", plugins: [] },
  request: { goal: { output: {} } },
};
export default function App() {
  const [url, setUrl] = useState(
    window.localStorage.getItem("api-url") || "http://127.0.0.1:8080",
  );
  const [token, setToken] = useState("");
  const [api, setApi] = useState<Api | null>(null);
  const [tab, setTab] = useState("Catalog");
  const [status, setStatus] = useState(
    "Connect to a STAC API, or start the bundled backend when you need it.",
  );
  const [busy, setBusy] = useState(false);
  const [descriptor, setDescriptor] = useState<Descriptor | null>(null);
  const [capability, setCapability] = useState("process");
  const [document, setDocument] = useState<Json>(empty);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [request, setRequest] = useState(
    JSON.stringify(empty.request, null, 2),
  );
  const [query, setQuery] = useState('{"limit":50}');
  const [items, setItems] = useState<Json[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [next, setNext] = useState<ReturnType<typeof nextPage>>(null);
  const [output, setOutput] = useState<Json>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [configName, setConfigName] = useState("default");
  const [configurations, setConfigurations] = useState<Json[]>([]);
  const [backend, setBackend] = useState<BackendStatus>({
    installed: false,
    running: false,
  });
  const [logs, setLogs] = useState("");
  const [collections, setCollections] = useState<string[]>([]);
  const key = (item: Json) =>
    JSON.stringify([item.collection ?? null, item.id]);
  useEffect(
    () =>
      window.desktop?.onLog((line) =>
        setLogs((previous) => (previous + "\n" + line).slice(-30000)),
      ),
    [],
  );
  const perform = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };
  function loadConfiguration(value: Json, plugins = descriptor?.plugins || []) {
    setDocument(value);
    setRequest(JSON.stringify(value.request, null, 2));
    setSelected(
      new Set(value.catalog?.plugins.map((plugin: Json) => plugin.use) || []),
    );
    const configured = new globalThis.Map(
      (value.catalog?.plugins || []).map((plugin: Json) => [
        plugin.use,
        plugin.settings || {},
      ]),
    );
    setSettings(
      Object.fromEntries(
        plugins.map((plugin) => [
          plugin.id,
          JSON.stringify(configured.get(plugin.id) || plugin.defaults, null, 2),
        ]),
      ),
    );
  }
  async function connect(target = url, bearer = token) {
    const client = new Api(target, bearer);
    const landing = await client.request("");
    setApi(client);
    setDescriptor(null);
    setItems([]);
    setChosen(new Set());
    setNext(null);
    window.localStorage.setItem("api-url", client.root);
    const catalog = await client.request("collections");
    setCollections(catalog.collections.map((value: Json) => value.id));
    try {
      const value: Descriptor = await client.request("autostacgis/plugins");
      const configuration = structuredClone(value.default_configuration);
      const source = configuration.catalog.plugins.find(
        (value: Json) => value.use === "stac-source",
      );
      if (source) source.settings = { api_url: client.root };
      setDescriptor(value);
      loadConfiguration(configuration, value.plugins);
      setStatus(
        `${landing.title || landing.id}: ${value.plugins.length} plugins available.`,
      );
    } catch (error) {
      setStatus(
        `Connected to STAC. AutoSTACGIS controls unavailable: ${error}`,
      );
    }
  }
  async function showPage(value: Json, base: string, body: Json) {
    setItems(value.features.map((item: Json) => resolveItem(item, base)));
    setChosen(new Set());
    setNext(nextPage(value, base, body));
    setStatus(`${value.features.length} items on this page.`);
  }
  function config() {
    if (!descriptor) throw new Error("Connect to an AutoSTACGIS backend");
    return buildConfiguration(
      { ...document, request: JSON.parse(request) },
      selected,
      settings,
      descriptor.plugins,
    );
  }
  async function invoke(operation: string, trigger?: string) {
    if (!api) throw new Error("Connect first");
    const inputs = items.filter((item) => chosen.has(key(item)));
    const value = await api.request("autostacgis/" + operation, "POST", {
      configuration: config(),
      ...(trigger ? { trigger } : inputs.length ? { inputs } : {}),
    });
    setOutput(value);
    setStatus(
      operation === "jobs"
        ? `Queued job ${value.id}`
        : "Completed " + operation,
    );
  }
  function selectPlugin(name: string, enabled: boolean) {
    const next = new Set(selected);
    if (enabled) {
      if (
        descriptor?.plugins.find((plugin) => plugin.id === name)?.capability ===
        "solver"
      )
        for (const plugin of descriptor?.plugins || [])
          if (plugin.capability === "solver") next.delete(plugin.id);
      next.add(name);
    } else next.delete(name);
    setSelected(next);
  }
  async function openAsset(
    asset: Json,
    label: string,
    item: Json,
    assetKey: string,
  ) {
    const uri = new URL(asset.href);
    if (!["http:", "https:"].includes(uri.protocol))
      throw new Error(
        "This desktop preview accepts HTTP(S) assets; use QGIS for other providers",
      );
    if (
      asset.type?.includes("geo+json") ||
      /\.(geojson|json)(\?|$)/i.test(uri.href)
    ) {
      const response = await fetch(uri, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(await response.text());
      const value = await response.json();
      if (!["FeatureCollection", "Feature"].includes(value.type))
        throw new Error("This JSON asset is not GeoJSON");
      addGeojson(value, label);
    } else if (
      asset.type?.includes("tiff") ||
      /\.(tif|tiff)(\?|$)/i.test(uri.href)
    ) {
      if (!api || !descriptor)
        throw new Error("Connect to an AutoSTACGIS backend for its COG tiler");
      const info = await api.request(
        "cog/info?url=" + encodeURIComponent(uri.href),
      );
      addRaster(item, assetKey, info, api.root);
      setStatus(
        "Raster added to Kepler; choose bands and styling in the Layers panel.",
      );
    } else {
      setStatus(
        "Use Kepler’s Add Data controls for additional formats, or open the asset in QGIS.",
      );
    }
  }
  return (
    <>
      <header>
        <div className="brand">
          <b>AutoSTACGIS</b>
          <span>STAC workspace</span>
        </div>
        <label>
          API URL
          <input
            aria-label="API URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label>
          Token
          <input
            aria-label="API token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <button disabled={busy} onClick={() => perform(() => connect())}>
          Connect
        </button>
      </header>
      <main>
        <Map />
        <aside>
          <nav>
            {["Catalog", "Plugins", "Workflow", "Jobs", "Backend"].map(
              (name) => (
                <button
                  key={name}
                  className={tab === name ? "active" : ""}
                  onClick={() => setTab(name)}
                >
                  {name}
                </button>
              ),
            )}
          </nav>
          <p className="status" role="status">
            {status}
          </p>
          <section>
            {tab === "Catalog" && (
              <>
                <h2>Search the catalog</h2>
                <small>
                  Collections: {collections.join(", ") || "connect to list"}
                </small>
                <label>
                  STAC search parameters
                  <textarea
                    aria-label="Search parameters"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <small>
                  Use collections, bbox, intersects, datetime, filter/CQL2,
                  sortby and other standard search fields.
                </small>
                <div className="row">
                  <button
                    disabled={!api || busy}
                    onClick={() =>
                      perform(async () => {
                        const body = JSON.parse(query);
                        await showPage(
                          await api!.search(body),
                          new URL("search", api!.root).href,
                          body,
                        );
                      })
                    }
                  >
                    Search
                  </button>
                  <button
                    disabled={!api || !next || busy}
                    onClick={() =>
                      perform(async () => {
                        await showPage(
                          await api!.request(
                            next!.url,
                            next!.method,
                            next!.body,
                          ),
                          next!.url,
                          next!.body,
                        );
                      })
                    }
                  >
                    Next page
                  </button>
                  <button
                    disabled={!items.length}
                    onClick={() =>
                      addGeojson(
                        { type: "FeatureCollection", features: items },
                        "STAC footprints",
                      )
                    }
                  >
                    Map footprints
                  </button>
                </div>
                {items.map((item) => (
                  <article key={key(item)}>
                    <label>
                      <input
                        type="checkbox"
                        checked={chosen.has(key(item))}
                        onChange={(event) => {
                          const value = new Set(chosen);
                          event.target.checked
                            ? value.add(key(item))
                            : value.delete(key(item));
                          setChosen(value);
                        }}
                      />
                      <b>{item.id}</b>
                    </label>
                    <small>{item.collection}</small>
                    {Object.entries(item.assets || {}).map(
                      ([name, asset]: [string, any]) => (
                        <div className="asset" key={name}>
                          <button
                            onClick={() =>
                              perform(() =>
                                openAsset(
                                  asset,
                                  `${item.id} / ${name}`,
                                  item,
                                  name,
                                ),
                              )
                            }
                          >
                            View {name}
                          </button>
                          <a
                            href={assetHref(asset.href)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
                          <small>{asset.type}</small>
                        </div>
                      ),
                    )}
                  </article>
                ))}
              </>
            )}
            {tab === "Plugins" &&
              (descriptor ? (
                <>
                  <h2>Plugin settings</h2>
                  <PluginSettings
                    descriptor={descriptor}
                    selected={selected}
                    settings={settings}
                    onSelect={selectPlugin}
                    onSettings={(name, value) =>
                      setSettings({ ...settings, [name]: value })
                    }
                    capability={capability}
                    onCapability={setCapability}
                    onStart={(name) => perform(() => invoke("jobs", name))}
                  />
                </>
              ) : (
                <p>
                  Connect to an AutoSTACGIS backend to load plugin contracts.
                </p>
              ))}
            {tab === "Workflow" && (
              <>
                <h2>Build a workflow</h2>
                <label>
                  Configuration name
                  <input
                    value={configName}
                    onChange={(event) => setConfigName(event.target.value)}
                  />
                </label>
                <label>
                  Request / goal
                  <textarea
                    className="large"
                    aria-label="Request"
                    value={request}
                    onChange={(event) => setRequest(event.target.value)}
                  />
                </label>
                <p>
                  {chosen.size
                    ? `${chosen.size} selected STAC Items will be used as inputs.`
                    : "No Items selected: discover through configured metadata sources."}
                </p>
                <div className="row">
                  {["validate", "plan", "jobs"].map((operation) => (
                    <button
                      disabled={!descriptor || busy}
                      key={operation}
                      onClick={() => perform(() => invoke(operation))}
                    >
                      {operation === "jobs" ? "Run" : operation}
                    </button>
                  ))}
                </div>
                <div className="row">
                  <button
                    disabled={!descriptor || busy}
                    onClick={() =>
                      perform(async () => {
                        await api!.request(
                          "autostacgis/configurations/" +
                            encodeURIComponent(configName),
                          "PUT",
                          config(),
                        );
                        setStatus("Configuration saved");
                      })
                    }
                  >
                    Save
                  </button>
                  <button
                    disabled={!descriptor || busy}
                    onClick={() =>
                      perform(async () =>
                        setConfigurations(
                          await api!.request("autostacgis/configurations"),
                        ),
                      )
                    }
                  >
                    Load list
                  </button>
                  <button
                    disabled={!descriptor}
                    onClick={() =>
                      perform(async () => {
                        const blob = new Blob(
                          [JSON.stringify(config(), null, 2)],
                          { type: "application/json" },
                        );
                        const link = globalThis.document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = configName + ".json";
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                      })
                    }
                  >
                    Export
                  </button>
                  <label className="import">
                    Import
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) =>
                        perform(async () => {
                          const file = event.target.files?.[0];
                          if (file)
                            loadConfiguration(JSON.parse(await file.text()));
                        })
                      }
                    />
                  </label>
                </div>
                {configurations.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => {
                      loadConfiguration(row.document);
                      setConfigName(row.id);
                    }}
                  >
                    {row.id}
                  </button>
                ))}
                {output && <pre>{JSON.stringify(output, null, 2)}</pre>}
              </>
            )}
            {tab === "Jobs" && (
              <>
                <h2>Workflow jobs</h2>
                <button
                  disabled={!descriptor || busy}
                  onClick={() =>
                    perform(async () =>
                      setJobs(await api!.request("autostacgis/jobs")),
                    )
                  }
                >
                  Refresh
                </button>
                {jobs.map((job) => (
                  <article key={job.id}>
                    <b>{job.state}</b>
                    <small>{job.id}</small>
                    {job.error && <p>{job.error}</p>}
                    <div className="row">
                      <button
                        onClick={() =>
                          perform(async () => {
                            const value = await api!.request(
                              "autostacgis/jobs/" + job.id,
                            );
                            setOutput(value);
                            if (value.result) {
                              setItems(value.result.features);
                              setChosen(new Set());
                              addGeojson(value.result, "Workflow outputs");
                              setTab("Catalog");
                            } else setStatus(value.state);
                          })
                        }
                      >
                        View result
                      </button>
                      <button
                        disabled={!["queued", "running"].includes(job.state)}
                        onClick={() =>
                          perform(async () => {
                            await api!.request(
                              "autostacgis/jobs/" + job.id,
                              "DELETE",
                            );
                            setJobs(await api!.request("autostacgis/jobs"));
                          })
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                ))}
              </>
            )}
            {tab === "Backend" && (
              <>
                <h2>Optional local backend</h2>
                <p>
                  Connect to your own URL above, or download and start the
                  bundled PostgreSQL service. Nothing starts when the app opens.
                </p>
                {window.desktop ? (
                  <>
                    <div className="row">
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(async () =>
                            setBackend(await window.desktop!.status()),
                          )
                        }
                      >
                        Check runtime
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(() => window.desktop!.downloadRuntime())
                        }
                      >
                        Download Docker runtime
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(() => window.desktop!.openInstaller())
                        }
                      >
                        Open downloaded installer
                      </button>
                    </div>
                    <p>{backend.message}</p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        perform(async () => {
                          const directory =
                            await window.desktop!.chooseInputDirectory();
                          if (directory)
                            setStatus(
                              "Input folder selected. Restart the local backend to use it at /data/incoming.",
                            );
                        })
                      }
                    >
                      Choose input folder
                    </button>
                    <div className="row">
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(() => window.desktop!.download())
                        }
                      >
                        Download backend
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(async () => {
                            const value = await window.desktop!.start();
                            setBackend(value);
                            setUrl(value.url!);
                            setToken(value.token!);
                            await connect(value.url!, value.token!);
                          })
                        }
                      >
                        Start backend
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          perform(async () => {
                            await window.desktop!.stop();
                            setBackend({ ...backend, running: false });
                            setStatus("Local backend stopped");
                          })
                        }
                      >
                        Stop backend
                      </button>
                    </div>
                    <pre aria-label="Backend log">
                      {logs || "Backend controls are idle."}
                    </pre>
                  </>
                ) : (
                  <p>
                    Use the Electron build for local backend controls. The
                    browser app connects to any deployed API.
                  </p>
                )}
              </>
            )}
          </section>
        </aside>
      </main>
    </>
  );
}
