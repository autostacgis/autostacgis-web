// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./store", () => ({ store: { dispatch: vi.fn() } }));
vi.mock("@kepler.gl/components", () => ({
  injectComponents: () => () => null,
  CustomPanelsFactory: () => null,
  PanelHeaderFactory: () => () => null,
  PanelToggleFactory: () => null,
  SidebarFactory: () => null,
  PanelTabFactory: () => null,
  Icons: {
    Db: () => null,
    Layers: () => null,
    Play: () => null,
    Clock: () => null,
    Settings: () => null,
  },
}));
import { AutostacGISPanelsFactory, WorkspaceNavigation } from "./sidebar";
import { WorkspaceContext } from "./workspace";
it("keeps native map controls and all application panels in one keyboard-accessible tab group", () => {
  const toggle = vi.fn();
  const custom = AutostacGISPanelsFactory().panels;
  const panels = ["layer", "filter", "interaction", "map"]
    .map((id) => ({ id, label: id }))
    .concat(custom);
  render(
    <WorkspaceNavigation
      panels={panels}
      activePanel="autostacgis-settings"
      togglePanel={toggle}
      PanelTab={() => <svg />}
    />,
  );
  expect(screen.getAllByRole("tablist")).toHaveLength(1);
  expect(screen.getAllByRole("tab")).toHaveLength(10);
  for (const name of [
    "Layers",
    "Filters",
    "Interactions",
    "Base map",
    "Catalog",
    "Plugins",
    "Metadata Structure",
    "Workflow",
    "Jobs",
    "Settings",
  ])
    expect(screen.getByRole("tab", { name })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Filters" }));
  expect(toggle).toHaveBeenLastCalledWith("filter");
  fireEvent.click(screen.getByRole("tab", { name: "Catalog" }));
  expect(toggle).toHaveBeenLastCalledWith("autostacgis-catalog");
  fireEvent.keyDown(screen.getByRole("tab", { name: "Settings" }), {
    key: "ArrowRight",
  });
  expect(toggle).toHaveBeenLastCalledWith("layer");
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "Layers" }),
  );
  cleanup();
});
it("renders application state inside the native custom panel component", () => {
  const SettingsPanel = AutostacGISPanelsFactory().panels.find(
    (panel) => panel.label === "Settings",
  )!.component;
  render(
    <WorkspaceContext.Provider
      value={(tab) => (
        <label>
          {tab}
          <input aria-label="Connection URL" />
        </label>
      )}
    >
      <SettingsPanel />
    </WorkspaceContext.Provider>,
  );
  expect(screen.getByLabelText("Connection URL")).toBeTruthy();
  cleanup();
});
