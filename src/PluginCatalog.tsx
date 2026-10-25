import { notify } from "./notifications";
import { useEffect, useState } from "react";
import type { Api } from "./api";
import type { Json } from "./types";
export const registryUrl =
  "https://autostacgis.github.io/autostacgis-plugins/plugins.json";
export default function PluginCatalog({
  api,
  onInstalled,
}: {
  api: Api | null;
  onInstalled: () => Promise<void>;
}) {
  const [plugins, setPlugins] = useState<Json[]>([]),
    [busy, setBusy] = useState(false);
  const setStatus = (value: string) => {
    notify.message(value);
  };
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      notify.error(String(error));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!api) return;
    const value = await api.request("autostacgis/plugins/available");
    if (value.format_version !== 1) throw Error("Unsupported plugin manifest");
    setPlugins(value.plugins);
    setStatus(`${value.plugins.length} published plugins`);
  }
  useEffect(() => {
    void run(refresh);
  }, [api]);
  return (
    <section className="plugin-catalog">
      <h2>Published plugins</h2>

      <button disabled={busy} onClick={() => run(refresh)}>
        Refresh online catalog
      </button>
      <label>
        Install Python file
        <input
          type="file"
          accept=".py,text/x-python"
          disabled={!api || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && api)
              void run(async () => {
                await api.request("autostacgis/plugins/install-file", "POST", {
                  filename: file.name,
                  source: await file.text(),
                });
                await onInstalled();
                setStatus(`Installed ${file.name}`);
              });
            event.target.value = "";
          }}
        />
      </label>

      <details>
        <summary>Available versions ({plugins.length})</summary>
        {plugins.map((plugin) => (
          <article key={plugin.id}>
            <strong>
              {plugin.id} {plugin.version}
            </strong>
            <small> · {plugin.capability}</small>
            <p>{plugin.description?.split("\n")[0]}</p>
            <button
              disabled={!api || busy}
              onClick={() =>
                run(async () => {
                  await api!.request("autostacgis/plugins/install", "POST", {
                    name: plugin.id,
                    version: plugin.version,
                  });
                  await onInstalled();
                  setStatus(`Installed ${plugin.id} ${plugin.version}`);
                })
              }
            >
              Install {plugin.version}
            </button>
          </article>
        ))}
      </details>
    </section>
  );
}
