import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDeflate, createInflate, crc32 } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_BUDGET = 3 * 1024 * 1024;

export function createGroupPublicationSurface(width: number, height: number) {
  const canvas = createCanvas(width, height);
  // Canvas 1.0.12 dithers gradients on 8-bit surfaces. In a tall group image,
  // that invisible noise triples the PNG size. Round the finished F16 surface
  // to 8-bit once instead; retain every panel, pixel dimension and text label.
  canvas.getContext('2d', { colorType: 'float16' });
  return canvas;
}

// Only called with PNGs encoded locally by Canvas, never uploaded image bytes.
// Streaming preserves the filtered pixels exactly without another full-image
// allocation, and runs zlib outside the request's JavaScript event loop.
export async function recompressGeneratedPng(bytes: Buffer): Promise<Buffer> {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Invalid generated PNG.');
  const chunks: { type: string; bytes: Buffer }[] = [];
  const imageData: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error('Incomplete generated PNG.');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    chunks.push({ type, bytes: bytes.subarray(offset, end) });
    if (type === 'IDAT') imageData.push(bytes.subarray(offset + 8, end - 4));
    offset = end;
  }
  if (!imageData.length) throw new Error('Missing generated PNG pixels.');
  const compressed: Buffer[] = [];
  await pipeline(Readable.from(imageData), createInflate(), createDeflate({ level: 9 }), async source => {
    for await (const chunk of source) compressed.push(chunk);
  });
  const payload = Buffer.concat(compressed);
  const replacement = Buffer.allocUnsafe(payload.length + 12);
  replacement.writeUInt32BE(payload.length, 0);
  replacement.write('IDAT', 4, 'ascii');
  payload.copy(replacement, 8);
  replacement.writeUInt32BE(crc32(replacement.subarray(4, -4)), replacement.length - 4);
  let replaced = false;
  const output = Buffer.concat([PNG_SIGNATURE, ...chunks.flatMap(chunk => {
    if (chunk.type !== 'IDAT') return [chunk.bytes];
    if (replaced) return [];
    replaced = true;
    return [replacement];
  })]);
  return output.length < bytes.length ? output : bytes;
}

export async function encodeGroupPublicationSurface(canvas: Canvas): Promise<Buffer> {
  // F16 PNGs contain 16-bit channels; convert once for normal 8-bit PNG output.
  const output = createCanvas(canvas.width, canvas.height);
  output.getContext('2d').drawImage(canvas, 0, 0);
  const bytes = await output.encode('png');
  return bytes.length <= IMAGE_BUDGET ? bytes : recompressGeneratedPng(bytes);
}
