import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AppRouter from "../AppRouter.jsx";
import { apiFetch } from "../api/client.js";
import { Button } from "../components/ui/Core.jsx";
import { setLanguage } from "../i18n/locale.js";
import { loadLanguageMessages } from "../i18n/translate.js";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), PERFORMANCE_MODE_STORAGE_KEY: "performance" }));
vi.mock("../seo/metadata.js", () => ({ applyDocumentMetadata: vi.fn() }));
vi.mock("../components/privacy/CookieConsent.jsx", () => ({ default: () => null }));
vi.mock("../components/loading/AppLoadingProvider.jsx", () => ({ useAppLoading: vi.fn() }));
vi.mock("../components/layout/AppChrome.jsx", () => ({ AmbientBackground: () => null }));
vi.mock("../pages/public/PublicPages.jsx", () => ({
  SiteHeader: () => <header>NXT5</header>, LEGAL_PAGES: {},
  AuthPage: () => <main data-page="auth" />,
  ForgotPasswordPage: () => <main data-page="recovery" />,
  HomeScreen: () => null, LegalPage: () => null, NotFoundPage: () => null, ResetPasswordPage: () => null,
}));

let renderer;
beforeEach(() => {
  setLanguage("fr", { persist: false });
  const browser = {
    location: new URL("https://nxt5.test/verified?error=signin&token=must-not-be-carried"),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), scrollTo: vi.fn(), setTimeout: vi.fn(),
  };
  const setUrl = (_state, _title, path) => { browser.location = new URL(path, browser.location); };
  browser.history = { pushState: vi.fn(setUrl), replaceState: vi.fn(setUrl) };
  vi.stubGlobal("window", browser);
  apiFetch.mockResolvedValue({ user: null });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  setLanguage("fr", { persist: false });
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function mount(user = null) {
  apiFetch.mockResolvedValue({ user });
  await act(async () => { renderer = TestRenderer.create(<AppRouter />); });
}
const text = () => JSON.stringify(renderer.toJSON());
const button = (label) => renderer.root.findAllByType(Button).find(node => node.props.children === label);

it("explains password proof and reopening the email without carrying its token into sign-in", async () => {
  await mount();
  expect(text()).toContain("mot de passe que tu as choisi lors de l’inscription");
  expect(text()).toContain("puis rouvre le lien reçu par e-mail dans ce même navigateur");
  expect(text()).not.toContain("must-not-be-carried");
  expect(text()).not.toContain("Email vérifié !");
  await act(async () => { button("Me connecter au compte concerné").props.onClick(); });
  expect(window.location.pathname).toBe("/connexion");
  expect(window.location.search).toBe("");
  expect(renderer.root.findByProps({ "data-page": "auth" })).toBeDefined();
  expect(apiFetch.mock.calls.map(([path]) => path)).toEqual(["auth-me"]);
});

it("ends a different account's session before opening sign-in", async () => {
  await mount({ id: "other-account", email_verified: true });
  await act(async () => { await button("Me connecter au compte concerné").props.onClick(); });
  expect(apiFetch).toHaveBeenCalledWith("auth-logout", { method: "POST" });
  expect(window.location.pathname).toBe("/connexion");
  expect(window.location.search).toBe("");
  expect(renderer.root.findByProps({ "data-page": "auth" })).toBeDefined();
});

it("waits for the current session before choosing whether to sign out", async () => {
  let resolveSession;
  apiFetch.mockReturnValueOnce(new Promise(resolve => { resolveSession = resolve; }));
  await act(async () => { renderer = TestRenderer.create(<AppRouter />); });
  expect(button("Vérification…").props.disabled).toBe(true);
  await act(async () => { resolveSession({ user: { id: "other-account", email_verified: true } }); });
  expect(button("Me connecter au compte concerné").props.disabled).toBe(false);
  await act(async () => { await button("Me connecter au compte concerné").props.onClick(); });
  expect(apiFetch).toHaveBeenCalledWith("auth-logout", { method: "POST" });
  expect(window.location.pathname).toBe("/connexion");
});

it("offers password recovery when the recipient does not recognize the registration", async () => {
  await mount();
  expect(text()).toContain("ne reconnais pas cette inscription");
  await act(async () => { button("Réinitialiser mon mot de passe").props.onClick(); });
  expect(window.location.pathname).toBe("/mot-de-passe-oublie");
  expect(window.location.search).toBe("");
  expect(renderer.root.findByProps({ "data-page": "recovery" })).toBeDefined();
});

it.each([
  ["en", "Sign in to verify your email", "did not sign up for this account"],
  ["es", "Inicia sesión para verificar tu correo", "no reconoces este registro"],
])("translates the security instructions into %s", async (language, title, recovery) => {
  await loadLanguageMessages(language);
  setLanguage(language, { persist: false });
  await mount();
  expect(text()).toContain(title);
  expect(text()).toContain(recovery);
  expect(text()).not.toContain("Connecte-toi pour vérifier ton e-mail");
});

it.each([
  ["?success=true", "Email vérifié !"],
  ["?error=expired", "Lien expiré"],
  ["?error=invalid", "Lien invalide"],
])("retains the verification result for %s", async (search, title) => {
  window.location.search = search;
  await mount();
  expect(text()).toContain(title);
  expect(button("Me connecter au compte concerné")).toBeUndefined();
});
