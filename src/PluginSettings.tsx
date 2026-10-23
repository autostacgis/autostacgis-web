import type { Descriptor } from "./types";
export default function PluginSettings({
  descriptor,
  selected,
  settings,
  onSelect,
  onSettings,
  capability,
  onCapability,
  onStart,
}: {
  descriptor: Descriptor;
  selected: Set<string>;
  settings: Record<string, string>;
  onSelect: (name: string, value: boolean) => void;
  onSettings: (name: string, value: string) => void;
  capability: string;
  onCapability: (value: string) => void;
  onStart: (name: string) => void;
}) {
  return (
    <>
      <div
        className="capabilities"
        role="tablist"
        aria-label="Plugin capabilities"
      >
        {descriptor.capabilities.map((name) => (
          <button
            role="tab"
            aria-selected={capability === name}
            className={capability === name ? "active" : ""}
            key={name}
            onClick={() => onCapability(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {descriptor.plugins
        .filter((plugin) => plugin.capability === capability)
        .map((plugin) => (
          <details
            className="plugin"
            key={plugin.id}
            open={selected.has(plugin.id) || undefined}
          >
            <summary>{plugin.id}</summary>
            <label>
              <input
                type="checkbox"
                checked={selected.has(plugin.id)}
                onChange={(event) => onSelect(plugin.id, event.target.checked)}
              />{" "}
              Enable plugin
            </label>
            {["apscheduler", "watchdog"].includes(plugin.id) && (
              <button
                disabled={!selected.has(plugin.id)}
                onClick={() => onStart(plugin.id)}
              >
                Start trigger
              </button>
            )}
            <small>Requires: {plugin.requires.join(", ") || "none"}</small>
            <label>
              Settings (JSON)
              <textarea
                aria-label={`${plugin.id} settings`}
                value={
                  settings[plugin.id] ??
                  JSON.stringify(plugin.defaults, null, 2)
                }
                onChange={(event) => onSettings(plugin.id, event.target.value)}
              />
            </label>
            <details>
              <summary>Parameter contract</summary>
              <pre>{JSON.stringify(plugin.settings_schema, null, 2)}</pre>
              {plugin.contract?.solver && (
                <p>Requires solver: {plugin.contract.solver}</p>
              )}
            </details>
          </details>
        ))}
    </>
  );
}
