# AutoSTACGIS desktop and web

Electron application for Windows, macOS and Linux, with Kepler.gl as the main map, data and layer UI. React, Redux, TypeScript and Vite follow Kepler's `examples/get-started-vite` stack. The browser build connects to the same STAC API; Electron adds optional local backend management.

## Develop

```sh
git submodule update --init --recursive
npm ci
npm run dev                 # browser client
npm run desktop:dev         # Electron + Vite
npm test
npm run build
```

Use Node 22.14+. Open a STAC API URL and optional session token. Browse collections and use standard search JSON (bbox/intersects, datetime, CQL2, sorting, etc.). Map the search footprints in Kepler, load GeoJSON assets and COG rasters through the backend’s TiTiler, select Items for a workflow, and use Kepler's existing data/layer/style controls. Additional raster, table and point-cloud formats remain available through Kepler’s native Add Data controls or QGIS. All installed plugin capabilities have tabs, each plugin has a settings editor and parameter contract, and dependencies/one-active-solver rules are enforced. Workflow configurations are shared with QGIS through the backend. Tokens are held in memory and are not saved in browser storage.

## Optional bundled backend

Check out the Python engine, standard plugins, and PostgreSQL service beside this repository. Install Python `build`, then run `npm run prepare:backend` and `npm run desktop`. Packaging runs preparation automatically. Backend source and engine wheels are copied into Electron resources, so an installed app does not require sibling checkouts or host Python. Docker downloads PostgreSQL/PostGIS and builds the Python API/worker images.

Opening the application never starts the backend. Use **Backend → Check runtime**, download Docker Desktop within the app if needed (macOS, Windows, or Linux x64 DEB/RPM; other Linux architectures open Docker Engine instructions), then **Download backend** and **Start backend**. Startup returns the loopback URL and a generated token. An existing Docker runtime is reused. Choose an input folder to mount it read-only at `/data/incoming`; use that path in file providers and watchdog settings. Stop shuts down this app's Compose project without deleting its database/results volumes. Closing Electron leaves an explicitly started service running until Stop or `docker compose --project-name autostacgis-desktop down` is used. The service also runs independently from its own repository. The API URL can always point elsewhere.

## Keep the Kepler fork updatable

`external/kepler.gl` is a pinned submodule of `autostacgis/kepler.gl`; upstream code is kept intact. The application starts from its Vite example and keeps STAC/Electron integration in this repository rather than rewriting Kepler internals. Default builds resolve the fork’s package entry points directly when the submodule is checked out. The matching published `3.3.0-alpha.18` packages supply dependencies and types; set `KEPLER_SOURCE=0` for a build using only published packages. Update/sync the fork normally, advance the submodule pointer, align Kepler package versions, and run the app tests/build. These changes do not require rebasing application code through upstream UI files.

## Package

`npm run dist` creates the installer for the current platform. GitHub Actions builds macOS DMG/ZIP, Windows NSIS, and Linux AppImage/DEB with the backend included. Local macOS builds use an ad-hoc signature. Distribution signing/notarization uses the normal electron-builder environment credentials (`CSC_LINK`/`CSC_NAME`); private keys are not configured in source. Browser production assets are in `dist/` and can be hosted separately; the STAC service's CORS origins must include that origin.

Renderer Node integration is disabled, context isolation and sandboxing are enabled, and preload exposes only fixed backend operations. The renderer cannot supply shell commands or arbitrary filesystem paths. Backend credentials are generated in the app's user-data directory and redacted from operation logs. Catalog text is rendered through React, not injected HTML.
