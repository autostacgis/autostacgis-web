import React from "react";
import { setLoaderOptions } from "@loaders.gl/core";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { Buffer } from "buffer";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./style.css";
import { initApplicationConfig } from "@kepler.gl/utils";
import { store } from "./store";
import App from "./App";
Object.assign(globalThis, { Buffer });
setWorkerUrl(mapWorkerUrl);
// Parse bounded preview tiles locally; Kepler otherwise fetches parser workers from a CDN.
setLoaderOptions({ worker: false });
initApplicationConfig({
  enableAnnotations: false,
  enableRasterTileLayer: true,
  rasterServerUseLatestTitiler: true,
  rasterServerSupportsElevation: false,
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
