import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export async function optimizeAsset(input, output, { width }) {
  const image = await loadImage(input);
  const height = Math.max(1, Math.round(image.height * width / image.width));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  await writeFile(output, await canvas.encode("webp", 82));
}

// Les déclinaisons du logo et des icônes sont produites par tools/logo-verre/build-brand.mjs.
// Ajouter ici les autres images à convertir : [source, destination WebP, { width }].
const tasks = [];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [input, output, resize] of tasks) {
    await optimizeAsset(input, output, resize);
    console.log(output);
  }
}
