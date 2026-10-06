import React, { Suspense } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import { useTeamCreation } from "../hooks/useTeamCreation.js";
import { Teams as TeamsView } from "../pages/workspace/Teams.jsx";
import { AccountSettings } from "../pages/workspace/AccountSettings.jsx";
import { Button, TextInput } from "../components/ui/Core.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn(), API_BASE: "/.netlify/functions" }));
const cleanups = [];
beforeEach(() => {
  vi.stubGlobal("window", { location: new URL("https://nxt5.test/equipes"), history: { pushState: (_state, _title, path) => { window.location = new URL(path, window.location); } }, addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(), scrollTo: vi.fn(), localStorage: { getItem: () => "full" } });
});
afterEach(() => { cleanups.splice(0).forEach((fn) => fn()); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function Teams(props) {
  const teamCreation = useTeamCreation(props);
  return <TeamsView {...props} teamCreation={teamCreation} />;
}

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
    expect(renderer.root.findAllByType("form")).toHaveLength(1);
    input(renderer, "Nom de l’équipe", "Deuxième équipe");
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
    await act(async () => renderer.root.findAllByType("form")[0].props.onSubmit({ preventDefault() {} }));
    expect(apiFetch).toHaveBeenCalledWith("teams-join", expect.objectContaining({ body: JSON.stringify({ invite: "NXT5-SECOND" }) }));
    expect(props.setSelectedTeamId).toHaveBeenCalledWith("second");
    expect(props.refreshAll).toHaveBeenCalledWith({ teamId: "second" });
  });
  it("keeps second-team access out of the roster header and opens or dismisses it through navigation", async () => {
    const props = teamProps();
    const renderer = await render(<Teams {...props} />);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType(Button).some((button) => button.props.children === "Créer ou rejoindre une équipe")).toBe(false);
    const showTeamAccessForms = async () => {
      window.history.pushState({}, "", "/equipes?setup=1");
      await act(async () => renderer.update(<Suspense fallback={<p>Chargement</p>}><Teams {...props} routeSearch={window.location.search} /></Suspense>));
    };
    await showTeamAccessForms();
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    const choices = renderer.root.findAllByProps({ className: "team-entry-choice" });
    expect(choices).toHaveLength(2);
    act(() => choices[1].props.onClick());
    expect(renderer.root.findAllByType("form")).toHaveLength(1);
    expect(renderer.root.findByProps({ label: "Code d’invitation" })).toBeTruthy();
    expect(renderer.root.findAllByProps({ label: "Nom de l’équipe" })).toHaveLength(0);
    act(() => renderer.root.findAllByType(Button).find((button) => button.props.children === "Fermer les formulaires").props.onClick());
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(window.location.pathname).toBe("/equipes");
    expect(window.location.search).toBe("");
  });

  it("starts with a choice, preserves creation fields when going back and shows join errors in place", async () => {
    const props = { ...teamProps(), data: { teams: [], players: [], matches: [] } };
    const renderer = await render(<Teams {...props} />);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    const choice = index => renderer.root.findAllByProps({ className: "team-entry-choice" })[index];
    act(() => choice(0).props.onClick());
    input(renderer, "Nom de l’équipe", "Ma nouvelle équipe");
    const goBack = () => act(() => renderer.root.findByProps({ className: "team-entry-back" }).props.onClick());
    goBack();
    act(() => choice(0).props.onClick());
    expect(renderer.root.findByProps({ label: "Nom de l’équipe" }).props.value).toBe("Ma nouvelle équipe");
    goBack();
    act(() => choice(1).props.onClick());
    input(renderer, "Code d’invitation", "OLD-CODE");
    apiFetch.mockRejectedValueOnce(new Error("Code expiré"));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(renderer.root.findByProps({ role: "alert" }).children).toContain("Code expiré");
    expect(renderer.root.findByProps({ label: "Code d’invitation" }).props.value).toBe("OLD-CODE");
    expect(renderer.root.findAllByType(Button).find(node => node.props.type === "submit").props.disabled).toBe(false);
  });
});

describe("email change reauthentication", () => {
  it("requires the current password only when the email changes and clears it on success", async () => {
    const user = { id: "u1", name: "Joueur", email: "old@example.com", email_verified: true };
    apiFetch.mockImplementation(async (endpoint) => {
      if (endpoint === "account-subscription") return { subscription: { planCode: "free", effectivePlanCode: null, status: "none" } };
      if (endpoint === "auth-social-status") return { providers: [], linked: [], hasPassword: true };
      if (endpoint === "auth-update-profile") return { user: { ...user, email: "new@example.com" } };
      throw new Error(`Unexpected request: ${endpoint}`);
    });
    const renderer = await render(<AccountSettings user={user} data={{}} onUserUpdate={vi.fn()} pushToast={vi.fn()} />);
    const emailPassword = () => renderer.root.findAllByType(TextInput).filter((field) => field.props.label === "Mot de passe actuel pour modifier l’e-mail");
    expect(emailPassword()).toHaveLength(0);
    input(renderer, "E-mail", "new@example.com");
    expect(emailPassword()).toHaveLength(1);
    act(() => emailPassword()[0].props.onChange("current-secret"));
    await act(async () => renderer.root.findAllByType("form")[0].props.onSubmit({ preventDefault() {} }));
    expect(JSON.parse(apiFetch.mock.calls.find(([endpoint]) => endpoint === "auth-update-profile")[1].body)).toMatchObject({ email: "new@example.com", currentPassword: "current-secret" });
    expect(emailPassword()[0].props.value).toBe("");
  });
});
