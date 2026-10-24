import { toast } from "sonner";
import { useEffect, useState } from "react";
export default function UpdateSettings() {
  const [state, setState] = useState<any>({});
  const desktop = window.desktop;
  useEffect(
    () =>
      desktop?.onUpdate?.((value) => {
        setState(value);
        if (value.message) toast.message(value.message, { id: "app-update" });
        if (value.backend?.message)
          toast.message(value.backend.message, { id: "backend-update" });
      }),
    [],
  );
  if (!desktop?.update) return null;
  const run = async (action: string) => {
    const id = toast.loading(
      action.includes("install")
        ? "Installing update…"
        : action === "download"
          ? "Downloading update…"
          : "Checking for updates…",
    );
    try {
      const value = await desktop.update!(action);
      setState(value);
      toast.success(
        (action.startsWith("backend")
          ? value.backend?.message
          : value.message) || "Update complete",
        { id },
      );
    } catch (error) {
      toast.error(String(error), { id });
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
      <p>{state.backend?.message}</p>
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
