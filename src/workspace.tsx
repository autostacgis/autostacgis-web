import { createContext, useContext, type ReactNode } from "react";
import { toggleSidePanel, wrapTo } from "@kepler.gl/actions";
import { store } from "./store";
export const workspaceTabs = [
  "Catalog",
  "Plugins",
  "Workflow",
  "Jobs",
  "Settings",
] as const;
export type WorkspaceTab = (typeof workspaceTabs)[number];
export const panelId = (tab: WorkspaceTab) =>
  "autostacgis-" + tab.toLowerCase();
export const WorkspaceContext = createContext<(tab: WorkspaceTab) => ReactNode>(
  () => null,
);
export function WorkspacePanel({ tab }: { tab: WorkspaceTab }) {
  return useContext(WorkspaceContext)(tab);
}
export function selectWorkspacePanel(tab: WorkspaceTab) {
  store.dispatch(wrapTo("map", toggleSidePanel(panelId(tab))));
}
