import fs from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
const svg = await fs.readFile(
  new URL("../assets/icon.svg", import.meta.url),
  "utf8",
);
await fs.mkdir("assets/icons", { recursive: true });
const render = (size) =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
await fs.writeFile("assets/icons/icon.png", render(1024));
await fs.copyFile("assets/icon.svg", "public/icon.svg");
await fs.writeFile("public/icon.png", render(128));
const sizes = [16, 32, 48, 64, 128, 256],
  images = sizes.map(render);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const at = 6 + 16 * i;
  header[at] = sizes[i] % 256;
  header[at + 1] = sizes[i] % 256;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
await fs.writeFile("assets/icons/icon.ico", Buffer.concat([header, ...images]));
const chunks = [
  [16, "icp4"],
  [32, "icp5"],
  [64, "icp6"],
  [128, "ic07"],
  [256, "ic08"],
  [512, "ic09"],
  [1024, "ic10"],
].map(([size, type]) => {
  const png = render(size),
    part = Buffer.alloc(8);
  part.write(type);
  part.writeUInt32BE(8 + png.length, 4);
  return Buffer.concat([part, png]);
});
const icns = Buffer.alloc(8);
icns.write("icns");
icns.writeUInt32BE(
  8 + chunks.reduce((total, part) => total + part.length, 0),
  4,
);
await fs.writeFile("assets/icons/icon.icns", Buffer.concat([icns, ...chunks]));
