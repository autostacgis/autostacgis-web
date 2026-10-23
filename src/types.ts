export type Json = any; // STAC extensions and plugin schemas intentionally accept arbitrary JSON.
export type Plugin = {
  id: string;
  capability: string;
  requires: string[];
  defaults: Json;
  settings_schema: Json;
  contract: Json;
};
export type Descriptor = {
  plugins: Plugin[];
  capabilities: string[];
  default_configuration: Json;
};
export type Job = { id: string; state: string; error?: string; result?: Json };
export type BackendStatus = {
  installed: boolean;
  running: boolean;
  url?: string;
  token?: string;
  message?: string;
};
export type Desktop = {
  chooseInputDirectory: () => Promise<string | null>;
  status: () => Promise<BackendStatus>;
  download: () => Promise<void>;
  start: () => Promise<BackendStatus>;
  stop: () => Promise<void>;
  downloadRuntime: () => Promise<void>;
  openInstaller: () => Promise<void>;
  onLog: (callback: (message: string) => void) => () => void;
};
declare global {
  interface Window {
    desktop?: Desktop;
  }
}
