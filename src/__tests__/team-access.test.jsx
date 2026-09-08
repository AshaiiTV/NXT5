import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { Teams } from "../pages/workspace/Teams.jsx";
import { AccountSettings } from "../pages/workspace/AccountSettings.jsx";
import { Button, TextInput } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
const cleanups = [];
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/equipes"), history: { pushState: (_state, _title, path) => { window.location = new URL(path, window.location); } }, dispatchEvent: vi.fn(), scrollTo: vi.fn(), localStorage: { getItem: () => "full" } });
});
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); vi.unstubAllGlobals(); });

async function render(element) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Suspense fallback={<p>Chargement</p>}>{element}</Suspense>); });
  cleanups.push(() => act(() => renderer.unmount()));
  return renderer;
}
const team = { id: "first", name: "Première équipe", tag: "ONE" };
const teamProps = () => ({ data: { teams: [team], players: [], matches: [], championPool: [] }, selectedTeamId: team.id, currentMember: { role: "owner" }, user: { id: "u1" }, setSelectedTeamId: vi.fn(), refreshAll: vi.fn(), pushToast: vi.fn() });
function input(renderer, label, value) { act(() => renderer.root.findByProps({ label }).props.onChange(value)); }

describe("joining and creating another team", () => {
  it("opens creation with an existing membership and selects the created team", async () => {
    const props = teamProps();
    const renderer = await render(<Teams {...props} routeSearch="?create=1" />);
    expect(renderer.root.findAllByType("form")).toHaveLength(2);
    input(renderer, "Nom de team", "Deuxième équipe");
    input(renderer, "Tag", "TWO");
    apiFetch.mockResolvedValueOnce({ team: { id: "second" } });
    await act(async () => renderer.root.findAllByType("form")[0].props.onSubmit({ preventDefault() {} }));
    expect(props.setSelectedTeamId).toHaveBeenCalledWith("second");
    expect(props.refreshAll).toHaveBeenCalledWith({ teamId: "second" });
    expect(window.location.search).toBe("");
  });
  it("accepts an invitation link when the user already belongs to a team", async () => {
    const props = teamProps();
    const renderer = await render(<Teams {...props} routeSearch="?invite=NXT5-SECOND" />);
    expect(renderer.root.findByProps({ label: "Code d’invitation" }).props.value).toBe("NXT5-SECOND");
    apiFetch.mockResolvedValueOnce({ team: { id: "second" } });
    await act(async () => renderer.root.findAllByType("form")[1].props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenCalledWith("teams-join", expect.objectContaining({ body: JSON.stringify({ invite: "NXT5-SECOND" }) }));
    expect(props.setSelectedTeamId).toHaveBeenCalledWith("second");
    expect(props.refreshAll).toHaveBeenCalledWith({ teamId: "second" });
  });
  it("provides a visible way to enter or dismiss the second-team forms", async () => {
    const renderer = await render(<Teams {...teamProps()} />);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    const open = () => renderer.root.findAllByType(Button).find((button) => button.props.children === "Créer ou rejoindre une équipe");
    act(() => open().props.onClick());
    expect(renderer.root.findAllByType("form")).toHaveLength(2);
    act(() => renderer.root.findAllByType(Button).find((button) => button.props.children === "Fermer les formulaires").props.onClick());
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
  });
});

describe("email change reauthentication", () => {
  it("requires the current password only when the email changes and clears it on success", async () => {
    const user = { id: "u1", name: "Joueur", email: "old@example.com", email_verified: true };
    apiFetch.mockResolvedValueOnce({ subscription: { planCode: "free", effectivePlanCode: "free", status: "none" } });
    const renderer = await render(<AccountSettings user={user} data={{}} onUserUpdate={vi.fn()} pushToast={vi.fn()} />);
    const emailPassword = () => renderer.root.findAllByType(TextInput).filter((field) => field.props.label === "Mot de passe actuel pour modifier l’e-mail");
    expect(emailPassword()).toHaveLength(0);
    input(renderer, "E-mail", "new@example.com");
    expect(emailPassword()).toHaveLength(1);
    act(() => emailPassword()[0].props.onChange("current-secret"));
    apiFetch.mockResolvedValueOnce({ user: { ...user, email: "new@example.com" } });
    await act(async () => renderer.root.findAllByType("form")[0].props.onSubmit({ preventDefault() {} }));
    expect(JSON.parse(apiFetch.mock.calls.find(([endpoint]) => endpoint === "auth-update-profile")[1].body)).toMatchObject({ email: "new@example.com", currentPassword: "current-secret" });
    expect(emailPassword()[0].props.value).toBe("");
  });
});
