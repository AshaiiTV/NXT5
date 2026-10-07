import assert from "node:assert/strict";
import test from "node:test";
import { requireNotarizationCredentials, verifyMacApp } from "../scripts/build-mac.mjs";

test("release refuses missing notarization credentials and never includes their values in errors", () => {
  assert.throws(() => requireNotarizationCredentials({}), /Notarisation Apple non configurée/);
  assert.throws(
    () => requireNotarizationCredentials({ APPLE_APP_SPECIFIC_PASSWORD: "private-test-value" }),
    (error) => error.message.includes("APPLE_ID") && !error.message.includes("private-test-value"),
  );
});

test("release honors builder credential precedence and rejects partial credentials", () => {
  assert.deepEqual(requireNotarizationCredentials({ APPLE_KEYCHAIN_PROFILE: "nxt5-notary" }), ["APPLE_KEYCHAIN_PROFILE"]);
  assert.deepEqual(requireNotarizationCredentials({ APPLE_API_KEY: "/private/key.p8", APPLE_API_KEY_ID: "key", APPLE_API_ISSUER: "issuer" }), ["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]);
  assert.throws(() => requireNotarizationCredentials({ APPLE_API_KEY_ID: "key", APPLE_KEYCHAIN_PROFILE: "valid-profile" }), /APPLE_API_KEY/);
  assert.throws(() => requireNotarizationCredentials({ APPLE_ID: "user@example.com", APPLE_KEYCHAIN_PROFILE: "valid-profile" }), /APPLE_APP_SPECIFIC_PASSWORD/);
  assert.deepEqual(requireNotarizationCredentials({ APPLE_ID: "user@example.com", APPLE_APP_SPECIFIC_PASSWORD: "example", APPLE_TEAM_ID: "team" }), ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"]);
});

const validDetails = "Authority=Developer ID Application: Example (TEAM)\nCodeDirectory flags=0x10000(runtime)\n";

test("archive verification rejects ad hoc, development, or non-hardened apps", () => {
  for (const details of ["Signature=adhoc", validDetails.replace("Developer ID Application", "Apple Development"), validDetails.replace("0x10000(runtime)", "0x0(none)")]) {
    const calls = [];
    assert.throws(() => verifyMacApp("/tmp/NXT5 Importer.app", (command) => {
      calls.push(command);
      return details;
    }), /Developer ID Application/);
    assert.deepEqual(calls, ["codesign", "/bin/sh"]);
  }
});

test("archive verification propagates signature, ticket and Gatekeeper failures", () => {
  for (const failingCommand of ["codesign", "xcrun", "spctl"]) {
    assert.throws(() => verifyMacApp("/tmp/NXT5 Importer.app", (command) => {
      if (command === failingCommand) throw new Error(`Rejected by ${command}`);
      return validDetails;
    }), new RegExp(`Rejected by ${failingCommand}`));
  }
});

test("archive verification requires all three Apple checks", () => {
  const calls = [];
  verifyMacApp("/tmp/NXT5 Importer.app", (command, args) => {
    calls.push([command, ...args]);
    return validDetails;
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[2], ["xcrun", "stapler", "validate", "/tmp/NXT5 Importer.app"]);
  assert.deepEqual(calls[3], ["spctl", "--assess", "--type", "execute", "--verbose=2", "/tmp/NXT5 Importer.app"]);
});
