# AutostacGIS desktop and web

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

Use Node 22.14+. Layers, Filters, Interactions, Base map, Catalog, Plugins, Workflow, Jobs, and Settings share Kepler's left sidebar. The map fills the window. Settings holds the connection choice and API credentials; the application display name is **AutostacGIS**.

Choose **Remote API** in Settings and enter a STAC API URL and optional session token. Catalog supports standard search JSON (bbox/intersects, datetime, CQL2, sorting), footprints, GeoJSON assets, and COGs through the connected service's TiTiler. Plugins groups every installed capability and exposes raw settings/contracts; Workflow plans or runs selected Items and shares configurations with QGIS. Tokens remain in memory rather than browser storage.

## Embedded backend without Docker

The desktop build bundles the Python engine, plugins, and service wheels. **Settings → Embedded backend → Download embedded backend** fetches a checksum-pinned native PostgreSQL/PostGIS bundle, matching PostgreSQL contrib modules (`btree_gist`, `unaccent`), and uv-managed Python 3.12, then installs the bundled wheels and their dependencies into the application's private runtime. No system Python, Docker, Java, or administrator installation is required. Downloading does not start PostgreSQL.

Choose **Start and connect** to initialize the private database, migrate pgSTAC, and start the API and worker on loopback with generated credentials and available ports. The API address stays stable across restarts so saved asset URLs and other clients keep working. Connection details are available for QGIS or another client. Choose an input folder and use its actual host path in local providers/watchdog settings. **Stop embedded backend** or closing the app stops its owned processes and retains catalog, configurations, jobs, and output files for the next session. Remote API mode remains available independently.

Native downloads support macOS Intel/Apple Silicon, Linux x64/arm64 (glibc), and Windows x64. Windows ARM users can use the x64 application or a remote API. Runtime URLs and SHA-256 pins are in `electron/runtime-manifest.json`. The initial download needs internet; later starts work offline. The independent service repository retains its optional Compose deployment. Existing Docker volumes are left untouched.

The suggested [pgembed](https://github.com/Ladybug-Memory/pgembed) does not supply PostGIS. This implementation uses [Serverpod's relocatable PostgreSQL/PostGIS bundles](https://github.com/serverpod/serverpod/tree/main/packages/serverpod_embedded_postgres) and matching [Zonky PostgreSQL contrib binaries](https://github.com/zonkyio/embedded-postgres-binaries) instead, with [uv](https://github.com/astral-sh/uv) only for Python installation. It uses the native binaries directly; it does not depend on Dart or the Java wrapper.

Check out `autostacgis-python`, `autostacgis-plugins`, and `autostacgis-postgresql` beside this repo, install Python `build`, and run `npm run prepare:backend` before testing desktop mode. Packaging does this automatically. `node scripts/smoke-embedded.mjs` tests the actual runtime download, API startup, stop/restart, and catalog persistence.

## Keep the Kepler fork updatable

`external/kepler.gl` remains a clean pinned submodule. The app uses Kepler's existing `CustomPanelsFactory`, `PanelToggleFactory`, and `PanelHeaderFactory` injection APIs for the integrated sidebar and branding; no fork patches or new fork commits are needed. Default builds consume the fork's source entry points. Matching published `3.3.0-alpha.18` packages supply dependencies/types; `KEPLER_SOURCE=0` builds from those packages instead. Sync the fork normally, advance its pointer, align package versions, and run tests/build.

## Package

`npm run dist` creates the installer for the current platform. GitHub Actions builds macOS DMG/ZIP, Windows NSIS, and Linux AppImage/DEB with the backend included. Local macOS builds use an ad-hoc signature. Distribution signing/notarization uses the normal electron-builder environment credentials (`CSC_LINK`/`CSC_NAME`); private keys are not configured in source. Browser production assets are in `dist/` and can be hosted separately; the STAC service's CORS origins must include that origin.

Renderer Node integration is disabled, context isolation and sandboxing are enabled, and preload exposes only fixed backend operations. The renderer cannot supply shell commands; input-folder selection uses the native chooser. Backend credentials are generated in the app's user-data directory and redacted from operation logs. Catalog text is rendered through React, not injected HTML.
