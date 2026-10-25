import { notify } from "./notifications";
import { useEffect, useState } from "react";
export default function UpdateSettings() {
  const [state, setState] = useState<any>({});
  const desktop = window.desktop;
  useEffect(
    () =>
      desktop?.onUpdate?.((value) => {
        setState(value);
        if (value.message) notify.message(value.message, { id: "app-update" });
        if (value.backend?.message)
          notify.message(value.backend.message, { id: "backend-update" });
      }),
    [],
  );
  if (!desktop?.update) return null;
  const run = async (action: string) => {
    if (action === "backend-install")
      notify.logs.start("backend-log", "Installing embedded backend update…");
    const id = notify.loading(
      action.includes("install")
        ? "Installing update…"
        : action === "download"
          ? "Downloading update…"
          : "Checking for updates…",
    );
    try {
      const value = await desktop.update!(action);
      setState(value);
      if (action === "backend-install")
        notify.logs.finish("backend-log", "Embedded backend updated");
      notify.success(
        (action.startsWith("backend")
          ? value.backend?.message
          : value.message) || "Update complete",
        { id },
      );
    } catch (error) {
      if (action === "backend-install") {
        notify.logs.append("backend-log", "\n" + String(error));
        notify.logs.finish("backend-log", "Backend update failed", "error");
      }
      notify.error(error, { id });
    }
  };
  return (
    <section>
      <h2>Application updates</h2>
      <div className="row">
        <button onClick={() => run("check")}>Check app update</button>
        <button disabled={!state.available} onClick={() => run("download")}>
          Download app update
        </button>
        <button disabled={!state.downloaded} onClick={() => run("install")}>
          Restart and install app
        </button>
      </div>
      <h3>Embedded backend updates</h3>
      <div className="row">
        <button onClick={() => run("backend-check")}>
          Check backend update
        </button>
        <button
          disabled={!state.backend?.available}
          onClick={() => run("backend-install")}
        >
          Install backend update
        </button>
      </div>
    </section>
  );
}
