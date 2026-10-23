import { createContext, useContext, useState, type ReactNode } from "react";
import { toggleSidePanel, wrapTo } from "@kepler.gl/actions";
import { store } from "./store";
export const workspaceTabs = [
  "Catalog",
  "Plugins",
  "Metadata Structure",
  "Workflow",
  "Jobs",
  "Settings",
] as const;
export type WorkspaceTab = (typeof workspaceTabs)[number];
export const panelId = (tab: WorkspaceTab) =>
  "autostacgis-" + tab.toLowerCase().replaceAll(" ", "-");
export const WorkspaceContext = createContext<(tab: WorkspaceTab) => ReactNode>(
  () => null,
);
export function WorkspacePanel({ tab }: { tab: WorkspaceTab }) {
  return useContext(WorkspaceContext)(tab);
}
export function selectWorkspacePanel(tab: WorkspaceTab) {
  store.dispatch(wrapTo("map", toggleSidePanel(panelId(tab))));
}

export const PanelLayoutContext = createContext({
  expanded: false,
  toggle: () => {},
});
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <PanelLayoutContext.Provider
      value={{ expanded, toggle: () => setExpanded((value) => !value) }}
    >
      <div
        className={expanded ? "workspace-layout expanded" : "workspace-layout"}
      >
        {children}
      </div>
    </PanelLayoutContext.Provider>
  );
}
