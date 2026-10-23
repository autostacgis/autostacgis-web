import { useEffect, useRef, useState } from "react";
import KeplerGl from "@kepler.gl/components";
import { addDataToMap, updateVisData, wrapTo } from "@kepler.gl/actions";
import { processGeojson } from "@kepler.gl/processors";
import { store } from "./store";
import type { Json } from "./types";
import { rasterDataset } from "./raster";
const styles = [
  {
    id: "osm",
    label: "OpenStreetMap",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
  },
];
export function addGeojson(value: Json, label: string) {
  const data = processGeojson(value);
  if (!data) throw new Error("No supported GeoJSON data");
  store.dispatch(
    wrapTo(
      "map",
      addDataToMap({
        datasets: { info: { id: crypto.randomUUID(), label }, data },
        options: { centerMap: true, readOnly: false },
      }),
    ),
  );
}
export function addRaster(
  item: Json,
  assetKey: string,
  info: Json,
  server: string,
) {
  const dataset = rasterDataset(item, assetKey, info, server);
  store.dispatch(
    wrapTo(
      "map",
      updateVisData(
        { ...dataset, info: { ...dataset.info, id: crypto.randomUUID() } },
        { autoCreateLayers: true, centerMap: true },
      ),
    ),
  );
}

export default function Map() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="map">
      <KeplerGl
        id="map"
        width={size.width}
        height={size.height}
        mapboxApiAccessToken=""
        mapStyles={styles}
        mapStylesReplaceDefault
        deckGlProps={{ deviceProps: { debug: false } }}
      />
    </div>
  );
}
