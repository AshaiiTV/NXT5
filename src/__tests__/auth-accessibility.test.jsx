import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { readRememberPreference } from "../app/helpers.js";
import { SocialLogin } from "../components/account/SocialAccounts.jsx";
import { PremiumToggle } from "../components/ui/Core.jsx";
import ProductStory from "../pages/home/ProductStory.jsx";
import { AuthPage } from "../pages/public/PublicPages.jsx";
import { getMetadata } from "../seo/metadata.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/audience-client.js", async (importOriginal) => ({ ...await importOriginal(), openCookieSettings: vi.fn(), trackAudienceEvent: vi.fn() }));

const cleanups = [];
function content(node) { return typeof node === "string" ? node : (node.children || []).map(content).join(""); }
async function render(element) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(element, { createNodeMock: () => ({ focus() {}, style: {} }) }); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
function stubStorage(getItem) {
  vi.stubGlobal("window", {
    location: { search: "", pathname: "/connexion", hash: "", assign: vi.fn() },
    localStorage: { getItem, setItem: vi.fn() },
  });
}

beforeEach(() => stubStorage(vi.fn(() => null)));
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("PremiumToggle accessible name", () => {
  it("names the switch by its title and describes it by its text", async () => {
    const renderer = await render(<PremiumToggle checked={false} onChange={vi.fn()} title="Rester connecté" text="30 jours sur cet appareil." />);
    const toggle = renderer.root.findByProps({ role: "switch" });
    const title = renderer.root.findByProps({ id: toggle.props["aria-labelledby"] });
    const text = renderer.root.findByProps({ id: toggle.props["aria-describedby"] });
    expect(content(title)).toBe("Rester connecté");
    expect(content(text)).toBe("30 jours sur cet appareil.");
    expect(toggle.props["aria-checked"]).toBe(false);
  });

  it("keeps ids unique between toggles and omits the description reference without text", async () => {
    const renderer = await render(<><PremiumToggle checked onChange={vi.fn()} title="A" /><PremiumToggle checked onChange={vi.fn()} title="B" /></>);
    const [first, second] = renderer.root.findAllByProps({ role: "switch" });
    expect(first.props["aria-labelledby"]).not.toBe(second.props["aria-labelledby"]);
    expect(first.props["aria-describedby"]).toBeUndefined();
  });
});

describe("remember-me preference", () => {
  it.each([[null, false], ["false", false], ["true", true]])("reads %s as %s", (stored, expected) => {
    stubStorage(vi.fn(() => stored));
    expect(readRememberPreference()).toBe(expected);
  });

  it("stays off when storage is unavailable", () => {
    stubStorage(vi.fn(() => { throw new Error("blocked"); }));
    expect(readRememberPreference()).toBe(false);
  });

  it("leaves the 30-day session switch off on a first sign-in", async () => {
    apiFetch.mockResolvedValue({ providers: [] });
    const renderer = await render(<AuthPage mode="login" navigate={vi.fn()} onAuth={vi.fn()} pushToast={vi.fn()} />);
    expect(renderer.root.findByType(PremiumToggle).props.checked).toBe(false);
  });
});

describe("account creation title", () => {
  it("is specific to /creer-un-compte and its legacy alias", () => {
    expect(getMetadata("/creer-un-compte").title).toBe("Créer un compte — NXT5");
    expect(getMetadata("/inscription").title).toBe("Créer un compte — NXT5");
    expect(getMetadata("/connexion").title).toBe("Connexion — NXT5");
  });
});

describe("social sign-in loading", () => {
  it("reserves the provider block with busy skeletons and a screen-reader status", async () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    const renderer = await render(<SocialLogin />);
    const section = renderer.root.findByProps({ "aria-busy": "true" });
    expect(section.findAll((node) => node.props.className === "nxt5-provider-skeleton")).toHaveLength(2);
    const status = renderer.root.findByProps({ role: "status" });
    expect(status.props.className).toBe("sr-only");
    expect(content(status)).toBe("Chargement des autres méthodes de connexion…");
  });

  it("shows a decorative Discord mark like the Google logo", async () => {
    apiFetch.mockResolvedValue({ providers: [{ id: "google", enabled: true }, { id: "discord", enabled: true }] });
    const renderer = await render(<SocialLogin />);
    const discord = renderer.root.findAllByType("button").find((node) => content(node).includes("Continuer avec Discord"));
    const mark = discord.findByType("svg");
    expect(mark.props["aria-hidden"]).toBe("true");
    expect(mark.props.width).toBe("20");
  });
});

describe("home detailed match summary", () => {
  it("does not leave a heading inside the closed disclosure", async () => {
    const renderer = await render(<ProductStory reduced />);
    const details = renderer.root.findByProps({ className: "ps-match-detail" });
    expect(details.findAll((node) => /^h[1-6]$/.test(node.type))).toHaveLength(0);
    await act(async () => { details.props.onToggle({ currentTarget: { open: true } }); });
    const heading = details.findByType("h3");
    expect(content(heading).trim()).not.toBe("");
  });
});
