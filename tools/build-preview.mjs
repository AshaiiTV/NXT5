import { spawnSync } from "node:child_process";

// Manual Netlify draft deploys do not set CONTEXT during a preceding local
// build. Provide an explicit noindex build for those previews on every OS.
const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", "build"], {
  stdio: "inherit",
  env: { ...process.env, CONTEXT: "deploy-preview" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
