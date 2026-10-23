import { expect, it } from "vitest";
import { rasterDataset } from "./raster";
it("supports current TiTiler dtype/count metadata and keeps signed COG URLs on the chosen tiler", () => {
  const href = "https://catalog.test/assets/image.tif?signature=a%2Fb";
  const value = rasterDataset(
    { id: "scene", assets: { data: { href } } },
    "data",
    { dtype: "uint16", count: 3 },
    "https://catalog.test/",
  );
  expect(value.metadata.assets.data.href).toBe(href);
  expect(value.metadata.assets.data.bands).toHaveLength(3);
  expect(value.metadata.assets.data.bands[2].data_type).toBe("uint16");
  expect(value.metadata.rasterTileServerUrls).toEqual(["https://catalog.test"]);
  expect(value.info.type).toBe("raster-tile");
});
