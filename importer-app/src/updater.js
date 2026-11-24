// Automatic updates without an installer: the new build is downloaded, checked against the
// SHA-256 published with the release, then swapped in place by a small script once the
// application has quit. Same file path, so shortcuts keep working and no copy piles up.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const MAX_UPDATE_BYTES = 400 * 1024 * 1024;

export function parseChecksums(text) {
  const sums = new Map();
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+?)\s*$/i.exec(line);
    if (match) sums.set(path.basename(match[2]), match[1].toLowerCase());
  }
  return sums;
}

// Where the running build lives and how to replace it, or why it cannot be done automatically.
export function installTarget({ platform, execPath, env = process.env, isPackaged }) {
  if (!isPackaged) return { supported: false, reason: "dev" };
  if (platform === "win32") {
    const file = env.PORTABLE_EXECUTABLE_FILE;
    if (!file || !/\.exe$/i.test(file)) return { supported: false, reason: "layout" };
    return { supported: true, kind: "windows", target: path.win32.resolve(file) };
  }
  if (platform === "darwin") {
    const bundle = path.posix.resolve(execPath, "..", "..", "..");
    if (!/\.app$/i.test(bundle)) return { supported: false, reason: "layout" };
    // Gatekeeper runs quarantined apps from a read-only copy: the user must move it first.
    if (bundle.includes("/AppTranslocation/") || bundle.startsWith("/Volumes/"))
      return { supported: false, reason: "readonly" };
    return { supported: true, kind: "mac", target: bundle };
  }
  return { supported: false, reason: "platform" };
}

export async function canWriteNextTo(target) {
  const probe = path.join(
    path.dirname(target),
    `.nxt5-write-test-${process.pid}-${Date.now()}`,
  );
  try {
    await fs.writeFile(probe, "");
    await fs.rm(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function downloadVerified(
  url,
  destination,
  { sha256, onProgress, fetchImpl = fetch, timeoutMs = 10 * 60 * 1000, maxBytes = MAX_UPDATE_BYTES } = {},
) {
  if (!/^[a-f0-9]{64}$/.test(String(sha256 || "")))
    throw new Error("Empreinte de la mise à jour introuvable.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const partial = `${destination}.part`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  let handle;
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "NXT5-Importer" },
    });
    if (!response.ok || !response.body)
      throw new Error(`Téléchargement indisponible (${response.status}).`);
    const total = Number(response.headers.get("content-length")) || 0;
    if (total > maxBytes) throw new Error("Mise à jour trop volumineuse.");
    const hash = crypto.createHash("sha256");
    handle = await fs.open(partial, "w");
    let received = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new Error("Mise à jour trop volumineuse.");
      hash.update(value);
      await handle.write(value);
      if (total) onProgress?.(Math.min(1, received / total));
    }
    await handle.close();
    handle = null;
    if (hash.digest("hex") !== sha256)
      throw new Error("Le fichier téléchargé est incomplet ou modifié.");
    await fs.rename(partial, destination);
    return destination;
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.rm(partial, { force: true }).catch(() => {});
    if (controller.signal.aborted)
      throw new Error("Le téléchargement de la mise à jour a expiré.");
    if (error instanceof TypeError)
      throw new Error("Connexion impossible pour télécharger la mise à jour.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Windows: the portable .exe is locked until the app (and its launcher) exit, so the script
// retries the swap, then starts the same path again. Copy first next to the target so the final
// replace stays on one volume and the old file is only removed once the new one is complete.
export const WINDOWS_SCRIPT = `param([string]$Source, [string]$Target, [int]$WaitPid, [string]$Relaunch)
$ErrorActionPreference = 'Stop'
try { Wait-Process -Id $WaitPid -Timeout 60 -ErrorAction SilentlyContinue } catch {}
$staged = "$Target.new"
$done = $false
try {
  [System.IO.File]::Copy($Source, $staged, $true)
  for ($i = 0; $i -lt 120 -and -not $done; $i++) {
    try { [System.IO.File]::Replace($staged, $Target, $null); $done = $true; Unblock-File -LiteralPath $Target -ErrorAction SilentlyContinue }
    catch { Start-Sleep -Milliseconds 500 }
  }
} catch {}
if (-not $done) { Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue }
Remove-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
if ($Relaunch -eq '1') { Start-Process -FilePath $Target }
`;

// macOS: the bundle is swapped once the app has exited; the previous one is restored on failure.
export const MAC_SCRIPT = `#!/bin/bash
SOURCE="$1"; TARGET="$2"; WAIT_PID="$3"; RELAUNCH="$4"; STAGING="$5"
for _ in $(seq 1 240); do kill -0 "$WAIT_PID" 2>/dev/null || break; sleep 0.25; done
OLD="$TARGET.nxt5-old"
rm -rf "$OLD"
if mv "$TARGET" "$OLD"; then
  if mv "$SOURCE" "$TARGET"; then
    rm -rf "$OLD"
    xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null
  else
    mv "$OLD" "$TARGET"
  fi
fi
rm -rf "$STAGING"
if [ "$RELAUNCH" = "1" ]; then open "$TARGET"; fi
`;

export async function prepareMacBundle(zipFile, target, run = runFile) {
  // Extract next to the installed app so the final move stays on the same volume.
  const staging = path.join(path.dirname(target), `.nxt5-update-${process.pid}`);
  await fs.rm(staging, { recursive: true, force: true });
  await fs.mkdir(staging, { recursive: true });
  await run("/usr/bin/ditto", ["-x", "-k", zipFile, staging]);
  const bundle = path.join(staging, path.basename(target));
  if (!fsSync.existsSync(path.join(bundle, "Contents", "Info.plist"))) {
    await fs.rm(staging, { recursive: true, force: true });
    throw new Error("Archive de mise à jour inattendue.");
  }
  return { bundle, staging };
}

function runFile(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(command)} a échoué (${code}).`)),
    );
  });
}

export async function launchSwap(staged, { relaunch, scriptDir, spawnImpl = spawn }) {
  await fs.mkdir(scriptDir, { recursive: true });
  const options = { detached: true, stdio: "ignore", windowsHide: true };
  let child;
  if (staged.kind === "windows") {
    const script = path.join(scriptDir, "apply-update.ps1");
    await fs.writeFile(script, WINDOWS_SCRIPT, "utf8");
    const powershell = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32", "WindowsPowerShell", "v1.0", "powershell.exe",
    );
    child = spawnImpl(powershell, [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
      "-File", script, "-Source", staged.file, "-Target", staged.target,
      "-WaitPid", String(process.pid), "-Relaunch", relaunch ? "1" : "0",
    ], options);
  } else {
    const script = path.join(scriptDir, "apply-update.sh");
    await fs.writeFile(script, MAC_SCRIPT, { mode: 0o700 });
    child = spawnImpl("/bin/bash", [
      script, staged.file, staged.target, String(process.pid), relaunch ? "1" : "0", staged.staging,
    ], options);
  }
  child.unref?.();
}
