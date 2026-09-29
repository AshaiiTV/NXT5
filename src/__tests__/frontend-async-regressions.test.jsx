import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { EmailVerificationRequiredModal } from "../AppContent.jsx";
import { AccountSettings } from "../pages/workspace/AccountSettings.jsx";
import { PlayerUltimateProfile } from "../pages/workspace/PlayerUltimateProfile.jsx";
import { Button, PremiumToggle, TextInput, ToastStack } from "../components/ui/Core.jsx";
import { createPortal } from "react-dom";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
vi.mock("../components/ui/ModalDialog.jsx", () => ({ ModalDialog: ({ children }) => <dialog open>{children}</dialog> }));
vi.mock("../components/account/AccountSubscription.jsx", () => ({ default: () => null }));
vi.mock("react-dom", async original => ({ ...await original(), createPortal: vi.fn((children) => children) }));
vi.mock("../app/performance.js", () => ({ configurePerformanceMode: vi.fn(), currentPerformanceMode: () => "full", setStoredPerformanceMode: vi.fn() }));
let renderer;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const user = { id: "u", name: "Coach", email: "typo@example.test", email_verified: false };
const text = () => JSON.stringify(renderer.toJSON());
const button = label => renderer.root.findAllByType(Button).find(node => node.props.children === label);
async function render(element) { await act(async () => { renderer = TestRenderer.create(element); }); }
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/mon-profil/coaching"), localStorage: { getItem: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  apiFetch.mockResolvedValue({ hasPassword: true, providers: [], linked: [] });
});
afterEach(() => { act(() => renderer?.unmount()); renderer = null; vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("B1 verification recovery", () => {
  it("corrects an email with reauthentication, retains errors and permits logout", async () => {
    const onLogout = vi.fn(), onUserUpdate = vi.fn();
    await render(<EmailVerificationRequiredModal user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />);
    act(() => renderer.root.findByProps({ label: "Nouvel e-mail" }).props.onChange("correct@example.test"));
    act(() => renderer.root.findByProps({ label: "Mot de passe actuel" }).props.onChange("password"));
    apiFetch.mockRejectedValueOnce(new Error("Mot de passe incorrect"));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(text()).toContain("Mot de passe incorrect");
    expect(renderer.root.findByProps({ label: "Nouvel e-mail" }).props.value).toBe("correct@example.test");
    const updated = { ...user, email: "correct@example.test" };
    apiFetch.mockResolvedValueOnce({ user: updated });
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenLastCalledWith("auth-update-profile", { method: "POST", body: JSON.stringify({ name: "Coach", email: "correct@example.test", currentPassword: "password" }) });
    expect(onUserUpdate).toHaveBeenCalledWith(updated);
    expect(renderer.root.findByProps({ label: "Mot de passe actuel" }).props.value).toBe("");
    act(() => button("Se déconnecter").props.onClick());
    expect(onLogout).toHaveBeenCalledOnce();
  });
  it("offers logout and an explanation for an account without a password", async () => {
    apiFetch.mockResolvedValueOnce({ hasPassword: false });
    await render(<EmailVerificationRequiredModal user={user} onLogout={vi.fn()} />);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType(Button)).toHaveLength(1);
    expect(text()).toContain("connexion sociale");
    expect(button("Se déconnecter").props.disabled).toBe(false);
  });
});

describe("B8 notification serialization", () => {
  it("disables all switches, refuses a second write and rolls back only the failed field", async () => {
    const onUserUpdate = vi.fn();
    await render(<AccountSettings user={user} onUserUpdate={onUserUpdate} />);
    const pending = deferred();
    apiFetch.mockImplementationOnce(() => pending.promise);
    const toggles = () => renderer.root.findAllByType(PremiumToggle);
    act(() => { toggles()[0].props.onChange(false); toggles()[1].props.onChange(false); });
    expect(toggles().every(node => node.props.disabled)).toBe(true);
    expect(renderer.root.findAllByProps({ role: "switch" }).every(node => node.props.disabled)).toBe(true);
    expect(apiFetch.mock.calls.filter(([path]) => path === "/api/user/notifications")).toHaveLength(1);
    // A fresh user snapshot updates a different preference while the write is pending.
    await act(async () => renderer.update(<AccountSettings user={{ ...user, notif_report: false }} onUserUpdate={onUserUpdate} />));
    await act(async () => pending.reject(new Error("Échec réseau")));
    expect(toggles()[0].props.checked).toBe(true);
    expect(toggles()[1].props.checked).toBe(false);
    expect(toggles().every(node => !node.props.disabled)).toBe(true);
    expect(onUserUpdate).not.toHaveBeenCalled();
  });
  it("ignores a response from the previous account", async () => {
    const onUserUpdate = vi.fn();
    await render(<AccountSettings user={user} onUserUpdate={onUserUpdate} />);
    const pending = deferred(); apiFetch.mockImplementationOnce(() => pending.promise);
    act(() => renderer.root.findAllByType(PremiumToggle)[0].props.onChange(false));
    await act(async () => renderer.update(<AccountSettings user={{ ...user, id: "other" }} onUserUpdate={onUserUpdate} />));
    await act(async () => pending.resolve({ user: { ...user, notif_match: false } }));
    expect(onUserUpdate).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(PremiumToggle)[0].props.checked).toBe(true);
  });
});

it.each([true, false])("B3 preserves edits after sending and resumes clean synchronization (edited: %s)", async (edited) => {
  const pending = deferred();
  const data = { teams: [{ id: "team", owner_id: "u" }], players: [{ id: "p", team_id: "team", user_id: "u", name: "Joueur", role: "TOP" }], profileCoachingNotes: [] };
  const refreshAll = vi.fn(async () => renderer.update(<PlayerUltimateProfile {...props} data={{ ...data, profileCoachingNotes: [{ team_id: "team", player_id: "p", content: "A normalisée" }] }} />));
  const props = { data, selectedTeamId: "team", user, currentMember: { role: "coach" }, route: { path: "/mon-profil/coaching", search: "" }, refreshAll };
  await render(<PlayerUltimateProfile {...props} />);
  const area = () => renderer.root.findByType("textarea");
  act(() => area().props.onChange({ target: { value: "A" } }));
  apiFetch.mockImplementationOnce(() => pending.promise);
  let save;
  act(() => { save = button("Enregistrer les notes").props.onClick(); });
  if (edited) act(() => area().props.onChange({ target: { value: "A puis B" } }));
  await act(async () => { pending.resolve({}); await save; });
  expect(area().props.value).toBe(edited ? "A puis B" : "A normalisée");
  expect(button("Enregistrer les notes").props.disabled).toBe(!edited);
  await act(async () => renderer.update(<PlayerUltimateProfile {...props} data={{ ...data, profileCoachingNotes: [{ team_id: "team", player_id: "p", content: "Nouvelle version partagée" }] }} />));
  expect(area().props.value).toBe(edited ? "A puis B" : "Nouvelle version partagée");
  expect(JSON.parse(apiFetch.mock.calls.find(([path]) => path === "player-coaching-notes-manage")[1].body).content).toBe("A");
});

it("B10 moves live clickable toasts into the last open dialog and back on close", async () => {
  let dialogs = [], observe;
  vi.stubGlobal("document", { body: {}, querySelectorAll: () => dialogs });
  vi.stubGlobal("MutationObserver", class { constructor(callback) { observe = callback; } observe() {} disconnect() {} });
  const removeToast = vi.fn();
  await render(<ToastStack toasts={[{ id: "t", title: "Erreur import", type: "red" }]} removeToast={removeToast} />);
  const first = {}, last = {};
  act(() => { dialogs = [first, last]; observe(); });
  expect(createPortal).toHaveBeenLastCalledWith(expect.anything(), last);
  expect(renderer.root.findByProps({ "aria-live": "polite" })).toBeTruthy();
  act(() => renderer.root.findByProps({ "aria-label": "Fermer la notification" }).props.onClick());
  expect(removeToast).toHaveBeenCalledWith("t");
  act(() => { dialogs = [first]; observe(); });
  expect(createPortal).toHaveBeenLastCalledWith(expect.anything(), first);
  createPortal.mockClear();
  act(() => { dialogs = []; observe(); });
  expect(createPortal).not.toHaveBeenCalled();
});
