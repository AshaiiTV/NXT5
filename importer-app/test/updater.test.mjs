import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  canWriteNextTo,
  downloadVerified,
  installTarget,
  launchSwap,
  parseChecksums,
} from "../src/updater.js";
import { selectUpdate } from "../src/core.js";

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const bodyOf = (data) =>
  new Response(data, { headers: { "content-length": String(data.length) } });

test("parseChecksums reads the release SHA256SUMS lines", () => {
  const a = "a".repeat(64), b = "B".repeat(64);
  const sums = parseChecksums(
    `${a}  NXT5-Importer-Windows-0.5.0.exe\r\n${b} *./NXT5-Importer-Mac-arm64-0.5.0.zip\ngarbage\n`,
  );
  assert.equal(sums.get("NXT5-Importer-Windows-0.5.0.exe"), a);
  assert.equal(sums.get("NXT5-Importer-Mac-arm64-0.5.0.zip"), b.toLowerCase());
  assert.equal(sums.size, 2);
});

test("selectUpdate exposes the asset name and the checksum file", () => {
  const base = "https://github.com/AshaiiTV/NXT5/releases/download/nxt5-match-exporter-latest/";
  const info = selectUpdate(
    {
      assets: ["NXT5-Importer-Windows-0.5.0.exe", "SHA256SUMS.txt"].map((name) => ({
        name,
        browser_download_url: base + name,
      })),
    },
    "0.4.9",
    "win32",
    "x64",
  );
  assert.equal(info.assetName, "NXT5-Importer-Windows-0.5.0.exe");
  assert.equal(info.checksumsUrl, base + "SHA256SUMS.txt");
  const foreign = selectUpdate(
    { assets: [{ name: "SHA256SUMS.txt", browser_download_url: "https://evil.test/SHA256SUMS.txt" }] },
    "0.4.9",
    "win32",
    "x64",
  );
  assert.equal(foreign.checksumsUrl, "");
});

test("installTarget replaces the running file in place", () => {
  assert.deepEqual(
    installTarget({
      platform: "win32",
      isPackaged: true,
      env: { PORTABLE_EXECUTABLE_FILE: "C:\\Users\\me\\Desktop\\NXT5-Importer-Windows-0.4.9.exe" },
    }).supported,
    true,
  );
  assert.equal(installTarget({ platform: "win32", isPackaged: true, env: {} }).supported, false);
  assert.equal(installTarget({ platform: "win32", isPackaged: false, env: {} }).reason, "dev");
  const mac = installTarget({
    platform: "darwin",
    isPackaged: true,
    execPath: "/Applications/NXT5 Importer.app/Contents/MacOS/NXT5 Importer",
  });
  assert.equal(mac.target, "/Applications/NXT5 Importer.app");
  assert.equal(
    installTarget({
      platform: "darwin",
      isPackaged: true,
      execPath: "/private/var/folders/x/AppTranslocation/ABC/d/NXT5 Importer.app/Contents/MacOS/NXT5 Importer",
    }).reason,
    "readonly",
  );
});

test("downloadVerified keeps only a file matching the published hash", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nxt5-update-"));
  try {
    const data = Buffer.from("new importer build");
    const progress = [];
    const file = await downloadVerified("https://example.test/a", path.join(dir, "a.exe"), {
      sha256: sha(data),
      fetchImpl: async () => bodyOf(data),
      onProgress: (value) => progress.push(value),
    });
    assert.deepEqual(await fs.readFile(file), data);
    assert.equal(progress.at(-1), 1);

    await assert.rejects(
      downloadVerified("https://example.test/b", path.join(dir, "b.exe"), {
        sha256: sha("something else"),
        fetchImpl: async () => bodyOf(data),
      }),
      /incomplet ou modifié/,
    );
    await assert.rejects(
      downloadVerified("https://example.test/c", path.join(dir, "c.exe"), {
        sha256: undefined,
        fetchImpl: async () => bodyOf(data),
      }),
      /Empreinte/,
    );
    await assert.rejects(
      downloadVerified("https://example.test/d", path.join(dir, "d.exe"), {
        sha256: sha(data),
        maxBytes: 4,
        fetchImpl: async () => bodyOf(data),
      }),
      /volumineuse/,
    );
    assert.deepEqual((await fs.readdir(dir)).sort(), ["a.exe"]);
    assert.equal(await canWriteNextTo(path.join(dir, "a.exe")), true);
    assert.equal(await canWriteNextTo(path.join(dir, "missing", "x")), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("launchSwap passes paths as arguments, never inside the script", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nxt5-swap-"));
  try {
    const calls = [];
    const spawnImpl = (command, args, options) => {
      calls.push({ command, args, options });
      return { unref() {} };
    };
    const tricky = "C:\\Users\\a'b $(x)\\NXT5.exe";
    await launchSwap(
      { kind: "windows", file: "C:\\tmp\\new.exe", target: tricky },
      { relaunch: true, scriptDir: dir, spawnImpl },
    );
    await launchSwap(
      { kind: "mac", file: "/tmp/s/NXT5 Importer.app", target: "/Applications/NXT5 Importer.app", staging: "/tmp/s" },
      { relaunch: false, scriptDir: dir, spawnImpl },
    );
    assert.ok(calls[0].args.includes(tricky));
    assert.equal(calls[0].args.at(-1), "1");
    assert.equal(calls[0].options.detached, true);
    assert.doesNotMatch(await fs.readFile(path.join(dir, "apply-update.ps1"), "utf8"), /a'b/);
    assert.equal(calls[1].command, "/bin/bash");
    assert.equal(calls[1].args.at(-2), "0");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
