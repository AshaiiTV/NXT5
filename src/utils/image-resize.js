// Reduces an image file in the browser before upload so team logos stay light.
// The longest side is capped at `maxSize` (aspect ratio kept, so the saved
// zoom/position framing still applies) and the result is re-encoded as WebP,
// falling back to PNG/JPEG on browsers that cannot encode WebP.
export async function resizeImageToDataUrl(file, { maxSize = 512, quality = 0.86, maxChars = 400_000 } = {}) {
  const image = await decodeImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("Image illisible.");
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image illisible.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  for (const [type, q] of [["image/webp", quality], ["image/png", undefined], ["image/jpeg", quality], ["image/jpeg", 0.7]]) {
    const url = canvas.toDataURL(type, q);
    if (url.startsWith(`data:${type};`) && url.length <= maxChars) return url;
  }
  throw new Error("Image trop lourde.");
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file); } catch { /* Fall back to <img> decoding. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Image illisible.")); image.src = url; });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
