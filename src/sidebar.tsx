import { version } from "../package.json";
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
  ConnectionContext,
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
      <div className="workspace-version">
        <small>v{version}</small>
        <a
          href="https://autostacgis.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Open AutostacGIS website"
          title="autostacgis.com"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 3h7v7M21 3l-11 11M11 3H3v18h18v-8" />
          </svg>
        </a>
      </div>
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
          appWebsite="https://autostacgis.com"
          version={version}
          logoComponent={Logo}
          actionItems={[
            ...(props.actionItems ||
              (Header as any).defaultProps?.actionItems ||
              []),
            {
              id: "expand",
              onClick: layout.toggle,
              iconComponent: () => (
                <button
                  type="button"
                  className="panel-expand"
                  aria-label={
                    layout.expanded ? "Contract panel" : "Expand panel"
                  }
                  aria-expanded={layout.expanded}
                  title={layout.expanded ? "Contract panel" : "Expand panel"}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d={
                        layout.expanded
                          ? "M3 9h6V3m12 12h-6v6M9 9L3 3m12 12 6 6"
                          : "M15 3h6v6M3 15v6h6M21 3l-7 7M3 21l7-7"
                      }
                    />
                  </svg>
                </button>
              ),
            },
          ]}
        />
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
  const connection = useContext(ConnectionContext);
  const disabled = (id: string) =>
    id.startsWith("autostacgis-") &&
    id !== panelId("Settings") &&
    !(id === panelId("Catalog") ? connection.catalog : connection.backend);
  const enabled = panels.filter((panel: any) => !disabled(panel.id));
  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="Workspace panels"
      aria-orientation="vertical"
    >
      {panels.map((panel: any) => {
        const label = names[panel.id] || panel.label;
        const activate = () => {
          if (!disabled(panel.id)) (panel.onClick || togglePanel)(panel.id);
        };
        return (
          <div
            key={panel.id}
            className="workspace-tab"
            role="tab"
            aria-label={label}
            aria-selected={activePanel === panel.id}
            aria-disabled={disabled(panel.id)}
            title={
              disabled(panel.id) ? "Connect to a backend in Settings" : label
            }
            tabIndex={!disabled(panel.id) && activePanel === panel.id ? 0 : -1}
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
                const index = enabled.indexOf(panel);
                const next =
                  (index + direction + enabled.length) % enabled.length;
                togglePanel(enabled[next].id);
                (
                  event.currentTarget.parentElement?.children[
                    panels.indexOf(enabled[next])
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
