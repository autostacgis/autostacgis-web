import { useEffect, useState } from "react";
import { notify } from "./notifications";
import type { Api } from "./api";
import type { Json } from "./types";
export default function WorkflowLibrary({
  api,
  document,
  activate,
  active,
  setActive,
}: {
  api: Api;
  document: () => Json;
  activate: (value: Json) => void;
  active: string | null;
  setActive: (value: string | null) => void;
}) {
  const [published, setPublished] = useState<Json[]>([]),
    [saved, setSaved] = useState<Json[]>([]),
    [choice, setChoice] = useState(""),
    [local, setLocal] = useState("");
  const [dialog, setDialog] = useState<"copy" | "rename" | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const path = (id: string) =>
    "autostacgis/workflows/" + encodeURIComponent(id);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      notify.error(String(error));
    } finally {
      setBusy(false);
    }
  }
  async function refreshSaved() {
    const rows = await api.request("autostacgis/workflows");
    if (!Array.isArray(rows)) throw Error("Invalid saved workflow response");
    setSaved(rows);
  }
  async function refresh() {
    await refreshSaved();
    const value = await api.request("autostacgis/workflows/available");
    if (!Array.isArray(value.workflows))
      throw Error("Invalid workflow manifest");
    setPublished(value.workflows);
  }
  useEffect(() => {
    void run(refresh);
  }, [api]);
  function showName(mode: "copy" | "rename") {
    setName(
      active ? (mode === "copy" ? active + " copy" : active) : "My workflow",
    );
    setDialog(mode);
  }
  return (
    <div className="workflow-library">
      <h2>Workflows</h2>
      <button disabled={busy} onClick={() => run(refresh)}>
        Refresh workflows
      </button>
      <label>
        Published
        <select
          aria-label="Published workflows"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">Choose a workflow</option>
          {published.map((row) => (
            <option key={row.id} value={row.id}>
              {row.id} · {row.version}
            </option>
          ))}
        </select>
      </label>
      <small>{published.find((row) => row.id === choice)?.description}</small>
      <button
        disabled={!choice || busy}
        onClick={() =>
          run(async () => {
            const value = await api.request(
              "autostacgis/workflows/published/" + encodeURIComponent(choice),
            );
            activate(value.document);
            setActive(null);
            notify.success("Workflow activated");
          })
        }
      >
        Activate published
      </button>
      <label>
        Saved
        <select
          aria-label="Saved workflows"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        >
          <option value="">Choose a saved workflow</option>
          {saved.map((row) => (
            <option key={row.id}>{row.id}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <button
          disabled={!local || busy}
          onClick={() => {
            activate(saved.find((row) => row.id === local).document);
            setActive(local);
            notify.success("Workflow activated");
          }}
        >
          Activate saved
        </button>
        <button
          disabled={!local || busy}
          onClick={() => {
            setName(local);
            setDialog("rename");
          }}
        >
          Rename
        </button>
        <button
          disabled={!local || busy}
          onClick={() =>
            run(async () => {
              await api.request(path(local), "DELETE");
              if (active === local) setActive(null);
              setLocal("");
              await refreshSaved();
              notify.success("Workflow deleted");
            })
          }
        >
          Delete
        </button>
      </div>
      <small>
        {active ? `Editing saved workflow: ${active}` : "Unsaved workflow"}
      </small>
      <div className="row">
        {active && (
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.request(path(active), "PUT", document());
                await refreshSaved();
                notify.success("Workflow updated");
              })
            }
          >
            Update saved workflow
          </button>
        )}
        <button disabled={busy} onClick={() => showName("copy")}>
          Save a copy
        </button>
      </div>
      {dialog && (
        <div className="name-dialog">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === "rename" ? "Rename workflow" : "Save workflow copy"
            }
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (dialog === "rename") {
                  const value = await api.request(path(local), "PATCH", {
                    name,
                  });
                  if (active === local) setActive(value.id);
                  setLocal(value.id);
                } else {
                  const value = await api.request(
                    "autostacgis/workflows",
                    "POST",
                    { name, document: document() },
                  );
                  setActive(value.id);
                  setLocal(value.id);
                }
                await refreshSaved();
                setDialog(null);
                notify.success(
                  dialog === "rename" ? "Workflow renamed" : "Workflow saved",
                );
              });
            }}
          >
            <label>
              Workflow name
              <input
                autoFocus
                value={name}
                required
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="row">
              <button disabled={busy || !name.trim()} type="submit">
                Save
              </button>
              <button type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
