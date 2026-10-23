import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { Backend } = require("../electron/backend.cjs");
const directory =
  process.env.AUTOSTACGIS_SMOKE_DIRECTORY ||
  (await mkdtemp(path.join(tmpdir(), "autostacgis-embedded-")));
const backend = new Backend({
  bundle: path.resolve("resources/backend"),
  data: directory,
  log: (line) => process.stdout.write(line),
});
try {
  if (!(await backend.status()).installed) await backend.download();
  let connection = await backend.start();
  assert(connection.running);
  const firstUrl = connection.url;
  const id = "smoke-" + crypto.randomUUID();
  const headers = {
    Authorization: "Bearer " + connection.token,
    "Content-Type": "application/json",
  };
  let response = await fetch(connection.url + "/autostacgis/plugins", {
    headers,
  });
  assert(response.ok);
  assert((await response.json()).plugins.length >= 82);
  response = await fetch(connection.url + "/collections", {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "Collection",
      stac_version: "1.1.0",
      id,
      description: "Embedded lifecycle test",
      license: "proprietary",
      links: [],
      extent: {
        spatial: { bbox: [[-180, -90, 180, 90]] },
        temporal: { interval: [[null, null]] },
      },
    }),
  });
  assert.equal(response.status, 201, await response.text());
  await backend.stop();
  assert.equal((await backend.status()).running, false);
  connection = await backend.start();
  assert.equal(connection.url, firstUrl);
  response = await fetch(connection.url + "/collections/" + id);
  assert(response.ok);
  assert.equal((await response.json()).id, id);
  console.log(
    "Native embedded backend passed: download, pgSTAC API, plugin contracts, stop, restart, retained catalog.",
  );
} finally {
  await backend.stop();
  if (!process.env.AUTOSTACGIS_SMOKE_DIRECTORY)
    await rm(directory, { recursive: true, force: true });
}
