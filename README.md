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

`npm run dist` creates the installer for the current platform. GitHub Actions builds macOS DMG/ZIP, Windows NSIS, and Linux AppImage with the backend included. Local macOS builds use an ad-hoc signature. Distribution signing/notarization uses the normal electron-builder environment credentials (`CSC_LINK`/`CSC_NAME`); private keys are not configured in source. Browser production assets are in `dist/` and can be hosted separately; the STAC service's CORS origins must include that origin.

Renderer Node integration is disabled, context isolation and sandboxing are enabled, and preload exposes only fixed backend operations. The renderer cannot supply shell commands; input-folder selection uses the native chooser. Backend credentials are generated in the app's user-data directory and redacted from operation logs. Catalog text is rendered through React, not injected HTML.


## Workspace and JSON editing

The left vertical rail contains Kepler's Layers, Filters, Interactions and Base map plus Catalog, Plugins, Metadata Structure, Workflow, Jobs and Settings. The expand/contract button beside Share fills the window with the current panel. The rail and title keep their left position; the map stays mounted behind the panel. All editable JSON uses the shared `src/JsonEditor.tsx` tree/text component. GUI changes preserve JSON types, nested objects and arrays; invalid text is kept for correction without overwriting it.

## Plugins and metadata structures

Plugins fetch the online versioned catalog from the connected backend (`/autostacgis/plugins/available`), or directly from the public registry when disconnected. Install a published version or a local `.py` file from Plugins. Installation runs on the connected backend and needs its write token. Each file declares one capability, a unique ID, semantic VERSION, required plugin names and Python dependencies. Publication is documented in the sibling plugins repository's CONTRIBUTING.md.

Metadata Structure edits the `metadata_structure` section saved with the workflow configuration. `schemas` references HTTPS STAC Item JSON Schemas; `inline` adds manual Item-level JSON Schema definitions, including declarations under `properties.properties` and asset schemas. Core STAC fields are included automatically. With strict mode enabled, undeclared nested fields produce an error. Add the extensions your data uses before processing it. Existing configurations without the section keep legacy validation.

## Build and release

Use Node 22+ and Python 3.12+. `make install`, `make dev`, `make dev-build`, `make test`, `make build`, `make dist`, and `make release` cover setup, desktop development, frontend compilation, tests, bundled backend preparation, unpacked desktop builds and local release artifacts. `make test-integration` exercises the native runtime and strict plugin/metadata API using disposable data. `make icons` regenerates PNG/ICO/ICNS and browser assets from `assets/icon.svg`. Check out the sibling Python, plugins and PostgreSQL repositories first. `PYTHON=/path/to/python make build` selects the wheel builder. The default Kepler checkout remains unchanged.

Electron app updates use `electron-updater` with GitHub Releases. Settings provides explicit Check, Download, and Restart/install actions. Backend updates have separate Check/install controls and use the PostgreSQL repository's latest `backend-release.json` with checksummed engine, plugin and service wheels. The app stops the local API, upgrades its private Python environment, records the selected release, and restarts it if it was running. Database files and credentials remain in the data directory. Failed wheel installation attempts restore the prior wheel set. PostgreSQL/PostGIS binary changes currently ship with desktop releases and the existing runtime downloader; the independent backend feed updates Python components.

To publish: bump the package version, commit and push a `vX.Y.Z` tag. `.github/workflows/release.yml` builds all three OS targets and publishes the installers and Electron update metadata. Production macOS automatic updates require a stable signing identity and notarization; configure MAC_CSC_LINK, MAC_CSC_KEY_PASSWORD and Apple notarization secrets. Windows releases use WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD for their signing certificate. Unsigned local artifacts are for development. Repository settings must allow the workflow to publish Releases. Backend tags publish their three wheels and update manifest through the sibling release workflow. This implementation does not create a live release until you push a release tag.

## Workflow library and plugin parameters

Workflows use one JSON document with plugin types as the top-level sections. The smallest explicit selection is `{"solver":{"backward_chain":{}},"goal":{"metadata-value":{"path":"properties.ready","value":true}}}`. Plugin dependencies and runtime defaults are resolved in Python. At most one trigger is active; omission runs immediately. Use `now`, `apscheduler`, or `watchdog` to choose how a workflow starts. See the [core configuration guide](https://github.com/autostacgis/autostacgis-python/blob/main/docs/workflows.md).

Plugin descriptions come from the required Python module docstring. Defaults, parameter descriptions and schemas are supplied by the library. Both JSON views edit the same document; the GUI offers declared optional parameters with their defaults. Unsupported complex annotations remain editable as JSON.

The workflow library lists published workflows and saved copies on the connected backend. Activate loads the JSON into the workflow editor. Published workflows can be saved as named copies; saved workflows can be updated, copied, renamed or deleted. Discovery and downloads use `autostacgis.workflow_manager.WorkflowManager`, sharing HTTPS and checksum verification with plugin installation. The backend exposes `/autostacgis/workflows`, `/workflows/available`, and `/workflows/published/{id}`. Save-copy is POST, update is PUT, rename is PATCH and delete is DELETE. `AUTOSTACGIS_WORKFLOW_REGISTRY_URL` selects another registry.

First start opens connection setup with an option to skip. The backend remains stopped until Start and connect is selected. Connection settings stay available in Settings. Backend-dependent tabs are disabled while disconnected. Status and errors use Sonner at the top center. The header reads its version from package.json and links to https://autostacgis.com.

## Prerelease messages and result saving

The application and maintained backend packages remain `0.0.1` during prerelease development. Backend updates compare wheel checksums to detect changed builds of the same prerelease version. Packaged frontend updates use a content fingerprint and publication date to distinguish newer `0.0.1` builds, while retaining electron-updater’s platform, rollout, download-integrity and installation handling. All status, update, error and installation-log messages use `src/notifications.tsx`, displayed through Sonner at the top center. The log mode keeps a bounded live tail in one expandable notification.

The initial configuration is a mosaic workflow. Plugin settings expose each named function result under `outputs`, including its saving defaults. Enable `save` to accept the plugin location, or override the encoder and destination path; goals stay independent of saving.
