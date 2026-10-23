import { useState } from "react";

type Props = {
  value: string;
  onChange?: (value: string) => void;
  label: string;
  readOnly?: boolean;
};
const kind = (value: any) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const initial: Record<string, any> = {
  object: {},
  array: [],
  string: "",
  number: 0,
  boolean: false,
  null: null,
};
function Node({
  value,
  change,
  path,
  readOnly,
}: {
  value: any;
  change: (value: any) => void;
  path: string;
  readOnly?: boolean;
}) {
  const type = kind(value);
  const [newKey, setNewKey] = useState("");
  return (
    <div className="json-node">
      <div className="json-value">
        <select
          aria-label={`${path} type`}
          value={type}
          disabled={readOnly}
          onChange={(e) => change(structuredClone(initial[e.target.value]))}
        >
          {Object.keys(initial).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {type === "string" && (
          <input
            aria-label={`${path} value`}
            value={value}
            readOnly={readOnly}
            onChange={(e) => change(e.target.value)}
          />
        )}
        {type === "number" && (
          <input
            aria-label={`${path} value`}
            type="number"
            value={value}
            readOnly={readOnly}
            onChange={(e) => {
              if (
                e.target.value !== "" &&
                Number.isFinite(e.target.valueAsNumber)
              )
                change(e.target.valueAsNumber);
            }}
          />
        )}
        {type === "boolean" && (
          <input
            aria-label={`${path} value`}
            type="checkbox"
            checked={value}
            disabled={readOnly}
            onChange={(e) => change(e.target.checked)}
          />
        )}
        {type === "null" && <code>null</code>}
      </div>
      {(type === "object" || type === "array") && (
        <div className="json-children">
          {Object.entries(value).map(([key, child], index) => (
            <details open key={key} className="json-field">
              <summary>{type === "array" ? `[${key}]` : key}</summary>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${path}.${key}`}
                  onClick={() => {
                    const next = structuredClone(value);
                    if (Array.isArray(next)) next.splice(index, 1);
                    else delete next[key];
                    change(next);
                  }}
                >
                  Remove
                </button>
              )}
              <Node
                value={child}
                path={`${path}.${key}`}
                readOnly={readOnly}
                change={(next) => {
                  const result = structuredClone(value);
                  result[key] = next;
                  change(result);
                }}
              />
            </details>
          ))}
          {!readOnly && (
            <div className="json-add">
              {type === "object" && (
                <input
                  aria-label={`${path} new key`}
                  placeholder="New field name"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
              )}
              <button
                type="button"
                disabled={
                  type === "object" && (!newKey || Object.hasOwn(value, newKey))
                }
                onClick={() => {
                  change(
                    type === "array"
                      ? [...value, null]
                      : Object.assign(Object.create(null), value, {
                          [newKey]: null,
                        }),
                  );
                  setNewKey("");
                }}
              >
                Add {type === "array" ? "item" : "field"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default function JsonEditor({
  value,
  onChange,
  label,
  readOnly,
}: Props) {
  const [mode, setMode] = useState<"gui" | "text">("gui");
  let parsed: any,
    error = "";
  try {
    parsed = JSON.parse(value);
  } catch (e) {
    error = String(e);
  }
  return (
    <div className="json-editor" role="group" aria-label={`${label} editor`}>
      <div className="json-toolbar">
        <strong>{label}</strong>
        <button
          type="button"
          aria-pressed={mode === "gui"}
          disabled={!!error}
          onClick={() => setMode("gui")}
        >
          GUI
        </button>
        <button
          type="button"
          aria-pressed={mode === "text"}
          onClick={() => setMode("text")}
        >
          Text
        </button>
      </div>
      {mode === "text" || error ? (
        <textarea
          aria-label={label}
          spellCheck={false}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <Node
          value={parsed}
          path="$"
          readOnly={readOnly}
          change={(next) => onChange?.(JSON.stringify(next, null, 2))}
        />
      )}
      {error && (
        <p role="alert">
          Invalid JSON: {error}. Fix the text to return to GUI editing.
        </p>
      )}
    </div>
  );
}
