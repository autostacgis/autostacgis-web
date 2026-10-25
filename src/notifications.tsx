import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Toaster, toast } from "sonner";

type LogState = {
  title: string;
  text: string;
  state: "running" | "success" | "error";
};
const channels = new Map<string, LogState>();
const muted = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
function updateLog(id: string, value: LogState) {
  channels.set(id, value);
  for (const listener of listeners) listener();
  if (!muted.has(id))
    toast.custom(() => <LogNotification id={id} />, {
      id,
      duration: Infinity,
      closeButton: false,
    });
}
function LogNotification({ id }: { id: string }) {
  const value = useSyncExternalStore(subscribe, () => channels.get(id)!);
  const [expanded, setExpanded] = useState(true);
  const tail = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (tail.current) tail.current.scrollTop = tail.current.scrollHeight;
  }, [value.text, expanded]);
  return (
    <section
      className="notification-log"
      role={value.state === "error" ? "alert" : "status"}
      data-state={value.state}
    >
      <div className="notification-log-heading">
        <strong>{value.title}</strong>
        <button
          aria-label={expanded ? "Collapse log" : "Expand log"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "−" : "+"}
        </button>
        <button
          aria-label="Close notification"
          onClick={() => {
            muted.add(id);
            toast.dismiss(id);
          }}
        >
          ×
        </button>
      </div>
      {expanded && (
        <pre ref={tail} aria-label="Installation log" tabIndex={0}>
          {value.text || "Preparing…"}
        </pre>
      )}
    </section>
  );
}
const logs = {
  start(id: string, title: string) {
    muted.delete(id);
    updateLog(id, { title, text: "", state: "running" });
    return id;
  },
  append(id: string, chunk: string) {
    const previous = channels.get(id) || {
      title: "Embedded backend log",
      text: "",
      state: "running" as const,
    };
    // A bounded tail accepts split lines, carriage-return progress and ANSI output.
    const text = (previous.text + chunk)
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/\r(?!\n)/g, "\n")
      .slice(-30000);
    updateLog(id, { ...previous, text });
  },
  finish(id: string, title: string, state: "success" | "error" = "success") {
    updateLog(id, { ...(channels.get(id) || { text: "" }), title, state });
  },
};
export const notify = {
  message: toast.message,
  success: toast.success,
  loading: toast.loading,
  dismiss: toast.dismiss,
  error(value: unknown, options?: Parameters<typeof toast.error>[1]) {
    const message = String(value);
    if (message.includes("\n") || message.length > 500) {
      if (options?.id !== undefined) toast.dismiss(options.id);
      const id = String(options?.id || "error-log");
      muted.delete(id);
      updateLog(id, {
        title: "Operation failed",
        text: message.slice(-30000),
        state: "error",
      });
      return id;
    }
    return toast.error(message, options);
  },
  logs,
};
export default function NotificationCenter() {
  return <Toaster position="top-center" theme="dark" richColors closeButton />;
}
