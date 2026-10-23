import type { Json } from "./types";
export function rasterDataset(
  item: Json,
  assetKey: string,
  info: Json,
  server: string,
) {
  const asset = item.assets[assetKey];
  const dtypes =
    info.dtypes ||
    Array(info.count || info.band_metadata?.length || 1).fill(
      info.dtype || "float32",
    );
  const bands = dtypes.map((dtype: string, index: number) => ({
    name: info.band_descriptions?.[index]?.[1] || `band-${index + 1}`,
    data_type: dtype,
  }));
  return {
    info: {
      label: `${item.id} / ${assetKey}`,
      type: "raster-tile",
      format: "rows",
    },
    data: { fields: [], rows: [] },
    metadata: {
      ...item,
      assets: { [assetKey]: { ...asset, bands } },
      rasterTileServerUrls: [server.replace(/\/$/, "")],
      rasterServerUseLatestTitiler: true,
      rasterServerSupportsElevation: false,
    },
    disableDataOperation: true,
  };
}
