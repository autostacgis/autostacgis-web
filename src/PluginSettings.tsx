import JsonEditor from "./JsonEditor";
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
      <label>
        Plugin type
        <select
          aria-label="Plugin type"
          value={capability}
          onChange={(event) => onCapability(event.target.value)}
        >
          {descriptor.capabilities.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {descriptor.plugins
        .filter((plugin) => plugin.capability === capability)
        .map((plugin) => (
          <details
            className="plugin"
            key={plugin.id}
            open={selected.has(plugin.id) || undefined}
          >
            <summary>
              {plugin.id} <small>{plugin.version}</small>
            </summary>
            <p>{plugin.description}</p>
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
              <JsonEditor
                schema={plugin.settings_schema}
                label={`${plugin.id} settings`}
                value={
                  settings[plugin.id] ??
                  JSON.stringify(plugin.defaults, null, 2)
                }
                onChange={(value) => onSettings(plugin.id, value)}
              />
            </label>
            <details>
              <summary>Parameter contract</summary>
              <JsonEditor
                label={`${plugin.id} contract`}
                value={JSON.stringify(plugin.settings_schema, null, 2)}
                readOnly
              />
              {plugin.contract?.solver && (
                <p>Requires solver: {plugin.contract.solver}</p>
              )}
            </details>
          </details>
        ))}
    </>
  );
}
