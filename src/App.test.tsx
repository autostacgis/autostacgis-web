// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("./store", () => ({ store: { dispatch: vi.fn() } }));
vi.mock("./Map", async () => {
  const { useState } = await import("react");
  const { WorkspacePanel, workspaceTabs } = await import("./workspace");
  return {
    default: () => {
      const [tab, setTab] = useState<any>("Settings");
      return (
        <div data-testid="kepler-map">
          <div role="tablist" aria-label="Workspace panels">
            {workspaceTabs.map((name) => (
              <button
                role="tab"
                key={name}
                aria-selected={tab === name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <WorkspacePanel tab={tab} />
        </div>
      );
    },
    addGeojson: vi.fn(),
    addRaster: vi.fn(),
  };
});
import App from "./App";
const descriptor = {
  capabilities: [
    "trigger",
    "data_in",
    "metadata_in",
    "checks",
    "sequence",
    "data_transfer",
    "checkpoint",
    "encode",
    "process",
    "data_out",
    "metadata_out",
    "goal",
    "solver",
    "services",
    "extensions",
  ],
  plugins: [
    {
      id: "metadata-value",
      capability: "goal",
      requires: ["backward_chain"],
      defaults: {},
      settings_schema: { type: "object" },
      contract: { solver: "backward_chain" },
    },
    {
      id: "backward_chain",
      capability: "solver",
      requires: [],
      defaults: { timeout: 120 },
      settings_schema: { type: "object" },
      contract: {},
    },
  ],
  default_configuration: {
    catalog: {
      version: "1.0.0",
      plugins: [
        { use: "metadata-value", settings: { jsonata: "true", value: true } },
      ],
    },
    request: { goal: { output: {} } },
  },
};
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
      removeItem: (key: string) => values.delete(key),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.desktop;
});
it("never starts or checks the bundled backend when opening the application", async () => {
  const desktop = {
    chooseInputDirectory: vi.fn(),
    start: vi.fn(),
    status: vi
      .fn()
      .mockResolvedValue({ installed: true, running: false, message: "ready" }),
    download: vi.fn(),
    stop: vi.fn(),
    onLog: vi.fn().mockReturnValue(() => {}),
  };
  window.desktop = desktop;
  render(<App />);
  expect(desktop.start).not.toHaveBeenCalled();
  expect(desktop.status).not.toHaveBeenCalled();
  expect(desktop.download).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Settings" }));
  expect(desktop.status).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Check status" }));
  await waitFor(() => expect(desktop.status).toHaveBeenCalledTimes(1));
  expect(desktop.start).not.toHaveBeenCalled();
});
it("connects, searches, selects an Item, and submits a plan with named dependencies", async () => {
  const calls: any[] = [];
  const item = {
    type: "Feature",
    id: "one",
    collection: "scenes",
    geometry: null,
    properties: {},
    assets: {},
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, options: any) => {
      calls.push([String(url), options]);
      const path = new URL(url).pathname;
      const value =
        path === "/collections"
          ? { collections: [{ id: "scenes" }] }
          : path === "/autostacgis/plugins"
            ? descriptor
            : path === "/search"
              ? { type: "FeatureCollection", features: [item], links: [] }
              : path === "/autostacgis/plan"
                ? { steps: [] }
                : { id: "catalog" };
      return new Response(JSON.stringify(value), { status: 200 });
    }),
  );
  render(<App />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "plugins available",
    ),
  );
  await user.click(screen.getByRole("tab", { name: "Catalog" }));
  await user.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("one");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("tab", { name: "Workflow" }));
  await user.click(screen.getByRole("button", { name: "plan" }));
  await waitFor(() =>
    expect(calls.some(([url]) => url.endsWith("/autostacgis/plan"))).toBe(true),
  );
  const body = JSON.parse(
    calls.find(([url]) => url.endsWith("/autostacgis/plan"))[1].body,
  );
  expect(body.inputs).toEqual([item]);
  expect(
    body.configuration.catalog.plugins.map((entry: any) => entry.use),
  ).toEqual(["backward_chain", "metadata-value"]);
  await user.click(screen.getByRole("tab", { name: "Plugins" }));
  for (const capability of descriptor.capabilities)
    expect(screen.getByRole("tab", { name: capability })).toBeTruthy();
});

it("keeps remote connection fields in Settings and starts the embedded service only on request", async () => {
  const desktop = {
    chooseInputDirectory: vi.fn(),
    onLog: vi.fn().mockReturnValue(() => {}),
    status: vi.fn(),
    download: vi.fn(),
    stop: vi.fn(),
    start: vi.fn().mockResolvedValue({
      installed: true,
      running: true,
      url: "http://127.0.0.1:58200",
      token: "private-token",
    }),
  };
  window.desktop = desktop;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: any) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("/collections")
              ? { collections: [] }
              : String(url).endsWith("/autostacgis/plugins")
                ? descriptor
                : { id: "embedded" },
          ),
        ),
    ),
  );
  render(<App />);
  const user = userEvent.setup();
  expect(screen.queryByLabelText("API URL")).toBeNull();
  expect(desktop.start).not.toHaveBeenCalled();
  await user.click(screen.getByRole("radio", { name: "Remote API" }));
  await user.clear(screen.getByLabelText("API URL"));
  await user.type(
    screen.getByLabelText("API URL"),
    "https://remote.example/stac",
  );
  await user.click(screen.getByRole("tab", { name: "Catalog" }));
  expect(screen.queryByLabelText("API URL")).toBeNull();
  await user.click(screen.getByRole("tab", { name: "Settings" }));
  expect((screen.getByLabelText("API URL") as HTMLInputElement).value).toBe(
    "https://remote.example/stac",
  );
  await user.click(screen.getByRole("radio", { name: "Embedded backend" }));
  await user.click(screen.getByRole("button", { name: "Start and connect" }));
  await waitFor(() => expect(desktop.start).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "plugins available",
    ),
  );
  expect(fetch).toHaveBeenCalledWith(
    new URL("http://127.0.0.1:58200/"),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer private-token",
      }),
    }),
  );
  expect(window.localStorage.getItem("api-url")).not.toBe(
    "http://127.0.0.1:58200/",
  );
});
