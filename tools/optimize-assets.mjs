import sharp from "sharp";

const tasks = [
  ["public/assets/nxt5-logo.png", "public/assets/nxt5-logo-640.webp", { width: 640 }],
  ["public/assets/nxt5-logo.png", "public/assets/nxt5-logo-320.webp", { width: 320 }],
  ["public/assets/nxt5-wordmark.png", "public/assets/nxt5-wordmark-640.webp", { width: 640 }],
  ["public/assets/nxt5-wordmark.png", "public/assets/nxt5-wordmark-320.webp", { width: 320 }],
  ["public/assets/nxt5-loader-favicon.png", "public/assets/nxt5-loader-favicon-256.webp", { width: 256 }],
  ["public/assets/nxt5-mark.png", "public/assets/nxt5-mark-160.webp", { width: 160 }],
];

for (const [input, output, resize] of tasks) {
  await sharp(input).resize(resize).webp({ quality: 82, effort: 6 }).toFile(output);
  console.log(`${output}`);
}
