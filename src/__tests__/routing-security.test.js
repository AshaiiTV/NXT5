import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLoginRedirect, isSafeInternalPath, openAppPath } from "../app/routing.js";

afterEach(() => vi.unstubAllGlobals());

describe("same-origin return paths", () => {
  it.each(["//outside.test", "/\\outside.test", "/\n/outside.test", "/\t/outside.test", "https://outside.test", "javascript:alert(1)", null])("rejects %s", path => {
    expect(isSafeInternalPath(path)).toBe(false);
    expect(buildLoginRedirect(path)).toBe("/connexion?next=%2Fequipes");
  });

  it.each(["/", "/mon-profil/champions", "/integration?team=123#upload"])("keeps %s", path => {
    expect(isSafeInternalPath(path)).toBe(true);
    expect(buildLoginRedirect(path)).toBe(`/connexion?next=${encodeURIComponent(path)}`);
  });

  it("uses a safe fallback and respects reduced motion", () => {
    const browser = { history: { pushState: vi.fn() }, dispatchEvent: vi.fn(), scrollTo: vi.fn(), matchMedia: () => ({ matches: true }) };
    vi.stubGlobal("window", browser);
    openAppPath("/\\outside.test");
    expect(browser.history.pushState).toHaveBeenCalledWith({}, "", "/equipes");
    expect(browser.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
