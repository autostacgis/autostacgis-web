import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { Backend } = require("../electron/backend.cjs");
const directory =
  process.env.AUTOSTACGIS_SMOKE_DIRECTORY ||
  (await mkdtemp(path.join(tmpdir(), "autostacgis-plugin-smoke-")));
const backend = new Backend({
  bundle: path.resolve("resources/backend"),
  data: directory,
  log: (line) => process.stdout.write(line),
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  if (!(await backend.status()).installed) await backend.download();
  let connection = await backend.start();
  const request = async (route, body, method = body ? "POST" : "GET") => {
    const response = await fetch(connection.url + "/autostacgis/" + route, {
      method,
      headers: {
        Authorization: "Bearer " + connection.token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json();
    return { response, value };
  };
  const configuration = {
    solver: { backward_chain: {} },
    goal: {
      "metadata-value": [
        { jsonata: "item.properties.ready", value: true },
        { jsonata: 'asset."data_state:statistics_calculated"', value: true },
      ],
    },
    process: { statistics: {} },
    services: { executor: { backend: "multiprocessing", workers: 2 } },
    metadata_structure: {
      schemas: [],
      inline: {
        properties: {
          properties: {
            properties: {
              ready: { type: "boolean" },
              "autostacgis:source_item_id": { type: "string" },
              "autostacgis:source_id": { type: "string" },
              "processing:software": {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
      strict: true,
    },
  };
  let published = await request("workflows/available");
  assert.equal(published.response.status, 200, JSON.stringify(published.value));
  assert(published.value.workflows.some((row) => row.id === "metadata-value"));
  published = await request("workflows/published/metadata-value");
  assert.equal(published.response.status, 200, JSON.stringify(published.value));
  const workflowName = "smoke-workflow-" + crypto.randomUUID();
  let saved = await request("workflows", {
    name: workflowName,
    document: published.value.document,
  });
  assert.equal(saved.response.status, 201, JSON.stringify(saved.value));
  saved = await request(
    "workflows/" + workflowName,
    { name: workflowName + " renamed" },
    "PATCH",
  );
  assert.equal(saved.response.status, 200, JSON.stringify(saved.value));
  const savedPath =
    "workflows/" + encodeURIComponent(workflowName + " renamed");
  saved = await request(savedPath, configuration, "PUT");
  assert.equal(saved.response.status, 200, JSON.stringify(saved.value));
  saved = await request(savedPath, undefined, "DELETE");
  assert.equal(saved.response.status, 200);
  const generated = await backend.run(backend.python, [
    "-c",
    `
import json,sys
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from types import SimpleNamespace
from pathlib import Path
from autostacgis import Record
from autostacgis.stac import Stac
from autostacgis.raster_metadata import inspect_raster
path=sys.argv[1]
with rasterio.open(path,"w",driver="GTiff",width=8,height=8,count=1,dtype="uint16",crs="EPSG:4326",transform=from_bounds(0,0,1,1,8,8)) as dst:
    dst.write(np.ones((1,8,8),dtype="uint16"))
item={"type":"Feature","stac_version":"1.1.0","id":"metadata-smoke","geometry":None,"properties":{"datetime":"2026-01-01T00:00:00Z","ready":True},"links":[],"assets":{"data":{"href":Path(path).resolve().as_uri(),"type":"image/tiff"}}}
record=Record(item)
inspect_raster(record,{},SimpleNamespace(stac=Stac()))
print("STAC_INPUT:"+json.dumps(record.item))
`,
    path.join(directory, "smoke-input.tif"),
  ]);
  const item = JSON.parse(
    generated
      .split("\n")
      .find((line) => line.startsWith("STAC_INPUT:"))
      .slice("STAC_INPUT:".length),
  );
  configuration.metadata_structure.schemas = item.stac_extensions;
  let result = await request("validate", { configuration, inputs: [item] });
  assert.equal(result.response.status, 200, JSON.stringify(result.value));
  const unknown = structuredClone(item);
  unknown.properties.undeclared = true;
  result = await request("validate", { configuration, inputs: [unknown] });
  assert.equal(result.response.status, 422);
  assert.match(result.value.detail, /Undeclared metadata field/);
  const source =
    '"""Verify a record condition in the installed plugin smoke test."""\nID = "registry-smoke-check"\nVERSION = "1.1.0"\nCAPABILITY = "checks"\nREQUIRES = []\nDEPENDENCIES = ["packaging>=24,<27"]\nclass Check:\n    def __call__(self, *args): return True\nIMPLEMENTATION = Check\n';
  result = await request("plugins/install-file", {
    filename: "registry_smoke_check.py",
    source,
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.module, "autostacgis_plugins.registry_smoke_check");
  result = await request("plugins");
  assert(
    result.value.plugins.some(
      (plugin) =>
        plugin.id === "registry-smoke-check" && plugin.version === "1.1.0",
    ),
  );
  result = await request("jobs", { configuration, inputs: [item] });
  assert.equal(result.response.status, 202, JSON.stringify(result.value));
  const id = result.value.id;
  for (let i = 0; i < 40; i++) {
    result = await request("jobs/" + id);
    if (!["queued", "running"].includes(result.value.state)) break;
    await pause(250);
  }
  assert.equal(result.value.state, "succeeded", JSON.stringify(result.value));
  assert.equal(result.value.result.features[0].properties.ready, true);
  const asset = result.value.result.features[0].assets.data;
  assert.equal(asset["data_state:statistics_calculated"], true);
  assert.equal(asset.bands[0].statistics.mean, 1);
  await backend.stop();
  connection = await backend.start();
  result = await request("plugins");
  assert(
    result.value.plugins.some((plugin) => plugin.id === "registry-smoke-check"),
  );
  console.log(
    "Plugin/metadata API passed: strict validation, versioned namespace installation, job publication, restart persistence.",
  );
} finally {
  await backend.stop();
  if (!process.env.AUTOSTACGIS_SMOKE_DIRECTORY)
    await rm(directory, { recursive: true, force: true });
}
