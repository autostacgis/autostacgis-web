import { useState } from "react";
import type { Json } from "./types";

type Props = {
  value: string;
  onChange?: (value: string) => void;
  label: string;
  readOnly?: boolean;
  schema?: Json;
};
const kind = (value: any) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const initial: Record<string, any> = {
  object: {},
  array: [],
  string: "",
  number: 0,
  integer: 0,
  boolean: false,
  null: null,
};
function defaultValue(schema: Json = {}) {
  if (Object.hasOwn(schema, "default")) return structuredClone(schema.default);
  if (schema.enum?.length) return schema.enum[0];
  return structuredClone(initial[schema.type] ?? null);
}
function Node({
  value,
  change,
  path,
  readOnly,
  schema = {},
}: {
  value: any;
  change: (value: any) => void;
  path: string;
  readOnly?: boolean;
  schema?: Json;
}) {
  const type = kind(value),
    [newKey, setNewKey] = useState("");
  const fields = schema.properties || {},
    available = Object.keys(fields).filter(
      (key) => !Object.hasOwn(value || {}, key),
    );
  const fixed = typeof schema.type === "string",
    allowed = fixed
      ? [schema.type === "integer" ? "number" : schema.type]
      : Object.keys(initial).filter((t) => t !== "integer");
  return (
    <div className="json-node">
      {schema.description && <small>{schema.description}</small>}
      <div className="json-value">
        <select
          aria-label={`${path} type`}
          value={type}
          disabled={readOnly || fixed}
          onChange={(e) => change(structuredClone(initial[e.target.value]))}
        >
          {[...new Set([...allowed, type])].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {schema.enum ? (
          <select
            aria-label={`${path} value`}
            value={JSON.stringify(value)}
            disabled={readOnly}
            onChange={(e) => change(JSON.parse(e.target.value))}
          >
            {schema.enum.map((v: any) => (
              <option key={JSON.stringify(v)} value={JSON.stringify(v)}>
                {String(v)}
              </option>
            ))}
          </select>
        ) : (
          <>
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
                step={schema.type === "integer" ? 1 : "any"}
                value={value}
                readOnly={readOnly}
                onChange={(e) => {
                  if (
                    e.target.value !== "" &&
                    Number.isFinite(e.target.valueAsNumber) &&
                    (schema.type !== "integer" ||
                      Number.isInteger(e.target.valueAsNumber))
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
          </>
        )}
      </div>
      {(type === "object" || type === "array") && (
        <div className="json-children">
          {Object.entries(value).map(([key, child], index) => (
            <details open key={key} className="json-field">
              <summary>
                {type === "array" ? `[${key}]` : key}
                {fields[key]?.type && (
                  <small>
                    {fields[key].type}
                    {schema.required?.includes(key) ? " · required" : ""}
                  </small>
                )}
              </summary>
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
                schema={
                  type === "array"
                    ? schema.items
                    : fields[key] ||
                      (typeof schema.additionalProperties === "object"
                        ? schema.additionalProperties
                        : {})
                }
                change={(next) => {
                  const result = structuredClone(value);
                  result[key] = next;
                  change(result);
                }}
              />
            </details>
          ))}
          {!readOnly && (
            <>
              {type === "object" && available.length > 0 && (
                <div className="json-add">
                  <select
                    aria-label={`${path} available parameters`}
                    value={Object.hasOwn(fields, newKey) ? newKey : ""}
                    onChange={(e) => setNewKey(e.target.value)}
                  >
                    <option value="">Choose a parameter</option>
                    {available.map((key) => (
                      <option key={key} value={key}>
                        {key} · {fields[key].type || "JSON"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!available.includes(newKey)}
                    onClick={() => {
                      change({
                        ...value,
                        [newKey]: defaultValue(fields[newKey]),
                      });
                      setNewKey("");
                    }}
                  >
                    Add parameter
                  </button>
                </div>
              )}
              {(type === "array" || schema.additionalProperties !== false) && (
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
                      type === "object" &&
                      (!newKey || Object.hasOwn(value, newKey))
                    }
                    onClick={() => {
                      change(
                        type === "array"
                          ? [...value, defaultValue(schema.items)]
                          : Object.assign(Object.create(null), value, {
                              [newKey]: defaultValue(fields[newKey]),
                            }),
                      );
                      setNewKey("");
                    }}
                  >
                    Add {type === "array" ? "item" : "field"}
                  </button>
                </div>
              )}
            </>
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
  schema,
}: Props) {
  const [mode, setMode] = useState("gui");
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
        <select
          aria-label={`${label} editing mode`}
          value={error ? "text" : mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="gui" disabled={!!error}>
            GUI
          </option>
          <option value="text">Text</option>
        </select>
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
          schema={schema}
          readOnly={readOnly}
          change={(next) => onChange?.(JSON.stringify(next, null, 2))}
        />
      )}
      {error && <p role="alert">Invalid JSON: {error}</p>}
    </div>
  );
}
