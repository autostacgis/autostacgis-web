import type { ComponentType, KeyboardEvent } from "react";
import {
  injectComponents,
  CustomPanelsFactory,
  PanelHeaderFactory,
  PanelToggleFactory,
  PanelTabFactory,
  Icons,
} from "@kepler.gl/components";
import { WorkspacePanel, workspaceTabs, panelId } from "./workspace";
const names: Record<string, string> = {
  layer: "Layers",
  filter: "Filters",
  interaction: "Interactions",
  map: "Base map",
};
const icons = [Icons.Db, Icons.Layers, Icons.Play, Icons.Clock, Icons.Settings];
export function AutostacGISPanelsFactory() {
  const Panels = () => null;
  Panels.panels = workspaceTabs.map((tab, index) => ({
    id: panelId(tab),
    label: tab,
    iconComponent: icons[index] || Icons.Layers,
    component: () => <WorkspacePanel tab={tab} />,
  }));
  return Panels;
}
function Logo() {
  return (
    <div className="workspace-brand">
      <strong>AutostacGIS</strong>
      <small>Geospatial workspace</small>
    </div>
  );
}
function HeaderFactory(...dependencies: Parameters<typeof PanelHeaderFactory>) {
  const Header = PanelHeaderFactory(...dependencies) as ComponentType<any>;
  return (props: any) => (
    <Header
      {...props}
      appName="AutostacGIS"
      version="0.1.0"
      logoComponent={Logo}
    />
  );
}
HeaderFactory.deps = PanelHeaderFactory.deps;
export function WorkspaceNavigation({
  panels,
  activePanel,
  togglePanel,
  PanelTab,
}: any) {
  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="Workspace panels"
    >
      {panels.map((panel: any) => {
        const label = names[panel.id] || panel.label;
        const activate = () => (panel.onClick || togglePanel)(panel.id);
        return (
          <div
            key={panel.id}
            className="workspace-tab"
            role="tab"
            aria-label={label}
            aria-selected={activePanel === panel.id}
            tabIndex={activePanel === panel.id ? 0 : -1}
            onClick={activate}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                activate();
              }
              const direction =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (direction) {
                event.preventDefault();
                const index = panels.indexOf(panel);
                const next =
                  (index + direction + panels.length) % panels.length;
                togglePanel(panels[next].id);
                (
                  event.currentTarget.parentElement?.children[
                    next
                  ] as HTMLElement
                )?.focus();
              }
            }}
          >
            <PanelTab
              panel={panel}
              isActive={activePanel === panel.id}
              onClick={() => {}}
            />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
function ToggleFactory(PanelTab: ReturnType<typeof PanelTabFactory>) {
  return (props: any) => <WorkspaceNavigation {...props} PanelTab={PanelTab} />;
}
ToggleFactory.deps = [PanelTabFactory];
const inject = injectComponents as (
  recipes: [Function, Function][],
) => ComponentType<any>;
export const KeplerWorkspace = inject([
  [CustomPanelsFactory, AutostacGISPanelsFactory],
  [PanelHeaderFactory, HeaderFactory],
  [PanelToggleFactory, ToggleFactory],
]);
