import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertTrustedIpcSender } from "../src/ipc-security.js";

function fixture(directory = "NXT5 Importer") {
  const rendererFile = path.resolve(
    os.tmpdir(),
    directory,
    "resources",
    "app.asar",
    "src",
    "renderer.html",
  );
  const frame = {
    url: pathToFileURL(rendererFile).href,
    detached: false,
    isDestroyed: () => false,
  };
  const contents = {
    mainFrame: frame,
    isDestroyed: () => false,
    getURL: () => pathToFileURL(rendererFile).href,
  };
  return {
    rendererFile,
    frame,
    contents,
    event: { sender: contents, senderFrame: frame },
  };
}

function accepts({ event, contents, rendererFile }) {
  assert.doesNotThrow(() =>
    assertTrustedIpcSender(event, contents, rendererFile),
  );
}

function refuses({ event, contents, rendererFile }) {
  assert.throws(
    () => assertTrustedIpcSender(event, contents, rendererFile),
    /IPC sender refused/,
  );
}

test("IPC accepts the main renderer from ordinary and special-character installation paths", () => {
  for (const directory of [
    "NXT5 Importer",
    "JOUEUR~1",
    "[joueur]",
    "Équipe française",
    "O'Neil (NXT5)",
    "NXT5 #1",
    "NXT5 100%",
    "literal%20folder",
  ]) {
    accepts(fixture(directory));
  }
});

test("IPC accepts equivalent encoded and Chromium-style raw tilde and brackets", () => {
  for (const directory of ["JOUEUR~1", "[joueur]", "[Équipe]~1"]) {
    const candidate = fixture(directory);
    candidate.frame.url = candidate.frame.url
      .replace(/%7e/gi, "~")
      .replace(/%5b/gi, "[")
      .replace(/%5d/gi, "]");
    accepts(candidate);
    candidate.frame.url = candidate.frame.url
      .replace(/~/g, "%7E")
      .replace(/\[/g, "%5B")
      .replace(/\]/g, "%5D");
    accepts(candidate);
  }
});

test("IPC decodes literal percent escapes exactly once", () => {
  const candidate = fixture("literal%20folder");
  assert.ok(candidate.frame.url.includes("literal%2520folder"));
  accepts(candidate);
  candidate.frame.url = candidate.frame.url.replace(
    "literal%2520folder",
    "literal%20folder",
  );
  refuses(candidate);
});

test("IPC refuses another webContents even when it reports the trusted renderer URL", () => {
  const candidate = fixture();
  candidate.event.sender = { ...candidate.contents };
  refuses(candidate);
});

test("IPC refuses another frame even when it has the trusted renderer URL", () => {
  const candidate = fixture();
  candidate.event.senderFrame = { ...candidate.frame };
  refuses(candidate);
});

test("IPC refuses missing event, sender, window, or frame without a getURL fallback", () => {
  const absentEvents = [null, undefined, {}, { senderFrame: fixture().frame }];
  for (const event of absentEvents) {
    refuses({ ...fixture(), event });
  }
  for (const contents of [null, undefined]) {
    refuses({ ...fixture(), contents });
  }
  for (const senderFrame of [null, undefined]) {
    const candidate = fixture();
    candidate.event.senderFrame = senderFrame;
    // The window still reports the valid URL; an absent source frame is untrusted.
    refuses(candidate);
  }
  const candidate = fixture();
  candidate.contents.mainFrame = null;
  refuses(candidate);
});

test("IPC refuses destroyed webContents and destroyed or detached main frames", () => {
  const destroyedContents = fixture();
  destroyedContents.contents.isDestroyed = () => true;
  refuses(destroyedContents);

  const destroyedFrame = fixture();
  destroyedFrame.frame.isDestroyed = () => true;
  refuses(destroyedFrame);

  const detachedFrame = fixture();
  detachedFrame.frame.detached = true;
  refuses(detachedFrame);
});

test("IPC refuses remote, data, blank and malformed renderer URLs", () => {
  for (const url of [
    "https://nxt5.org/renderer.html",
    "https://attacker.example/renderer.html",
    "data:text/html,<h1>NXT5</h1>",
    "about:blank",
    "javascript:void(0)",
    "not a URL",
    "file://[",
    "",
    null,
    undefined,
  ]) {
    const candidate = fixture();
    candidate.frame.url = url;
    refuses(candidate);
  }
});

test("IPC refuses different files, prefix lookalikes and foreign file hosts", () => {
  const candidate = fixture();
  for (const otherFile of [
    path.join(path.dirname(candidate.rendererFile), "other.html"),
    `${candidate.rendererFile}.attacker.html`,
    path.join(path.dirname(candidate.rendererFile), "renderer.html", "child.html"),
    path.resolve(path.dirname(candidate.rendererFile), "..", "renderer.html"),
  ]) {
    candidate.frame.url = pathToFileURL(otherFile).href;
    refuses(candidate);
  }
  const remote = new URL(pathToFileURL(candidate.rendererFile));
  remote.hostname = "attacker.example";
  candidate.frame.url = remote.href;
  refuses(candidate);
});

test("IPC refuses encoded path separators and malformed percent escapes", () => {
  const candidate = fixture();
  const original = candidate.frame.url;
  for (const replacement of [
    "src%2Frenderer.html",
    "src%5Crenderer.html",
    "src/%",
    "src/%ZZ",
    "src/%C3%28",
    "src/renderer.html%00",
  ]) {
    candidate.frame.url = original.replace("src/renderer.html", replacement);
    refuses(candidate);
  }
});

test("IPC refuses query strings and fragments on the trusted file", () => {
  const candidate = fixture();
  const original = candidate.frame.url;
  for (const suffix of ["?debug=1", "#other", "?file=renderer.html#other"]) {
    candidate.frame.url = original + suffix;
    refuses(candidate);
  }
});
