import { execFileSync } from "node:child_process";
import { access, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectDir = fileURLToPath(new URL("../", import.meta.url));

// Match electron-builder 26's credential precedence. notarize:true alone can
// silently skip notarization when credentials are missing, so fail first.
export function requireNotarizationCredentials(env) {
  const appleId = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
  const apiKey = ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"];
  const required = env.APPLE_ID || env.APPLE_APP_SPECIFIC_PASSWORD
    ? appleId
    : apiKey.some((name) => env[name])
      ? apiKey
      : env.APPLE_KEYCHAIN_PROFILE
        ? ["APPLE_KEYCHAIN_PROFILE"]
        : appleId;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Notarisation Apple non configurée : ${missing.join(", ")}. Voir docs/macos-signing.md.`);
  }
  return required;
}

export function verifyMacApp(appPath, run = execFileSync) {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { stdio: "inherit" });
  // codesign writes metadata to stderr, even on success.
  const details = run("/bin/sh", ["-c", 'codesign --display --verbose=4 "$1" 2>&1', "codesign", appPath], { encoding: "utf8" });
  if (!/^Authority=Developer ID Application:/m.test(details) || !/flags=.*\bruntime\b/.test(details)) {
    throw new Error("La version distribuée doit porter une signature Developer ID Application avec Hardened Runtime.");
  }
  run("xcrun", ["stapler", "validate", appPath], { stdio: "inherit" });
  run("spctl", ["--assess", "--type", "execute", "--verbose=2", appPath], { stdio: "inherit" });
}

async function buildMac(args) {
  if (process.platform !== "darwin") throw new Error("La construction macOS nécessite un Mac.");
  const preview = args.includes("--preview");
  const architectures = args.filter((arg) => arg !== "--preview");
  if (architectures.some((arch) => !["x64", "arm64"].includes(arch))) {
    throw new Error("Usage : node scripts/build-mac.mjs [--preview] [x64|arm64]");
  }
  if (!architectures.length) architectures.push("x64", "arm64");

  if (!preview) {
    const credentials = requireNotarizationCredentials(process.env);
    if (credentials.includes("APPLE_API_KEY")) await access(process.env.APPLE_API_KEY);
    if (!process.env.CSC_LINK) {
      const identities = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
      if (!identities.includes('"Developer ID Application:')) {
        throw new Error("Aucun certificat Developer ID Application valide. Installer le certificat et sa clé privée, ou configurer CSC_LINK / CSC_KEY_PASSWORD. Voir docs/macos-signing.md.");
      }
    }
  }

  const { build, Platform, Arch } = await import("electron-builder");
  const manifest = JSON.parse(await readFile(path.join(projectDir, "package.json"), "utf8"));
  const output = path.join(projectDir, preview ? "release-preview" : "release");
  const archivePath = (arch) => path.join(output, `NXT5-Importer-Mac-${arch}-${manifest.version}.zip`);
  for (const arch of architectures) await rm(archivePath(arch), { force: true });
  if (preview) {
    console.log("Aperçu local ad hoc : cette version n'est pas notarisée et ne doit pas être publiée.");
  }
  await build({
    projectDir,
    // Only expose a final ZIP after all checks pass; builder must not emit an
    // unverified archive at the distribution path before our verification.
    targets: Platform.MAC.createTarget(["dir"], ...architectures.map((arch) => Arch[arch])),
    publish: "never",
    config: preview ? {
      directories: { output },
      mac: { identity: "-", forceCodeSigning: false, hardenedRuntime: false, notarize: false },
    } : {},
  });

  // Notarization and stapling finish inside electron-builder before packaging.
  // Preserve the ticket with ditto, then validate the actual distributed ZIP.
  for (const arch of architectures) {
    const appName = `${manifest.build.productName}.app`;
    const appPath = path.join(output, arch === "arm64" ? "mac-arm64" : "mac", appName);
    const zipPath = archivePath(arch);
    const staging = await mkdtemp(path.join(output, ".nxt5-mac-package-"));
    try {
      const stagedZip = path.join(staging, "app.zip");
      execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, stagedZip], { stdio: "inherit" });
      const extracted = path.join(staging, "extracted");
      execFileSync("ditto", ["-x", "-k", stagedZip, extracted], { stdio: "inherit" });
      if (preview) {
        execFileSync("codesign", ["--verify", "--deep", "--strict", path.join(extracted, appName)], { stdio: "inherit" });
      } else {
        verifyMacApp(path.join(extracted, appName));
      }
      await rename(stagedZip, zipPath);
      console.log(`${preview ? "Aperçu" : "Archive signée, notarisée et vérifiée"} : ${zipPath}`);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  buildMac(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
