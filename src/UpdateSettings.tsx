import { useEffect, useState } from "react";
export default function UpdateSettings() {
  const [state, setState] = useState<any>({}),
    [status, setStatus] = useState("");
  const desktop = window.desktop;
  useEffect(() => desktop?.onUpdate?.(setState), []);
  if (!desktop?.update) return null;
  const run = async (action: string) => {
    try {
      setState(await desktop.update!(action));
      setStatus("");
    } catch (e) {
      setStatus(String(e));
    }
  };
  return (
    <section>
      <h2>Application updates</h2>
      <p>
        Frontend and embedded backend updates are downloaded separately. Your
        catalog and configuration stay in the backend data directory.
      </p>
      <p>
        {state.message || "Check for a new release when you want to update."}
      </p>
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
      {status && <p role="status">{status}</p>}
    </section>
  );
}
