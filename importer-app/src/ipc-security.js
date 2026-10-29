import path from "node:path";
import { fileURLToPath } from "node:url";

export function assertTrustedIpcSender(event, webContents, rendererFile) {
  const frame = event?.senderFrame;
  if (
    !webContents ||
    webContents.isDestroyed() ||
    event?.sender !== webContents ||
    !frame ||
    frame !== webContents.mainFrame ||
    frame.detached ||
    frame.isDestroyed()
  )
    throw new Error("IPC sender refused");

  try {
    const url = new URL(frame.url);
    // Chromium and Node may encode the same file path differently (~, [, ]).
    // Compare decoded paths, while still trusting only our exact local document.
    if (
      url.protocol === "file:" &&
      !url.search &&
      !url.hash &&
      path.resolve(fileURLToPath(url)) === path.resolve(rendererFile)
    )
      return;
  } catch {
    // Malformed URLs and encoded path separators must fail closed.
  }
  throw new Error("IPC sender refused");
}
