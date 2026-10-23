import {
  Children,
  useContext,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import {
  injectComponents,
  CustomPanelsFactory,
  PanelHeaderFactory,
  PanelToggleFactory,
  PanelTabFactory,
  Icons,
  SidebarFactory,
} from "@kepler.gl/components";
import {
  WorkspacePanel,
  workspaceTabs,
  panelId,
  PanelLayoutContext,
} from "./workspace";
const names: Record<string, string> = {
  layer: "Layers",
  filter: "Filters",
  interaction: "Interactions",
  map: "Base map",
};
const icons = [
  Icons.Db,
  Icons.Layers,
  Icons.Layers,
  Icons.Play,
  Icons.Clock,
  Icons.Settings,
];
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
      <strong>
        <img src="/icon.svg" alt="" />
        AutostacGIS
      </strong>
      <small>Geospatial workspace</small>
    </div>
  );
}
function HeaderFactory(...dependencies: Parameters<typeof PanelHeaderFactory>) {
  const Header = PanelHeaderFactory(...dependencies) as ComponentType<any>;
  return (props: any) => {
    const layout = useContext(PanelLayoutContext);
    return (
      <div className="workspace-header">
        <Header
          {...props}
          appName="AutostacGIS"
          version="0.2.0"
          logoComponent={Logo}
        />
        <button
          className="panel-expand"
          aria-label={layout.expanded ? "Contract panel" : "Expand panel"}
          aria-expanded={layout.expanded}
          title={layout.expanded ? "Contract panel" : "Expand panel"}
          onClick={layout.toggle}
        >
          {layout.expanded ? "↙" : "↗"}
        </button>
      </div>
    );
  };
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
      aria-orientation="vertical"
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
              const direction = ["ArrowDown", "ArrowRight"].includes(event.key)
                ? 1
                : ["ArrowUp", "ArrowLeft"].includes(event.key)
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
function VerticalSidebarFactory() {
  return function VerticalSidebar({ children }: any) {
    const { expanded } = useContext(PanelLayoutContext);
    const parts = Children.toArray(children);
    return (
      <aside
        className={expanded ? "workspace-shell is-expanded" : "workspace-shell"}
        aria-label="AutostacGIS workspace"
      >
        <div className="workspace-heading">{parts[0]}</div>
        <div className="workspace-rail">
          {parts.length > 2 ? parts[1] : null}
        </div>
        <div className="workspace-content">{parts[parts.length - 1]}</div>
      </aside>
    );
  };
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
  [SidebarFactory, VerticalSidebarFactory],
  [PanelHeaderFactory, HeaderFactory],
  [PanelToggleFactory, ToggleFactory],
]);
