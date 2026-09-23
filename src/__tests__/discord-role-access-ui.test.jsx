import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client.js";
import DiscordRoleAccess from "../components/discord/DiscordRoleAccess.jsx";

vi.mock("../api/client.js", () => ({ apiFetch: vi.fn() }));

const guildId = "100000000000000001";
const roleA = "100000000000000011";
const roleB = "100000000000000012";
const metadata = { connection: { guildId }, health: { verified: true }, roles: [{ id: roleA, name: "Joueurs" }, { id: roleB, name: "Staff" }] };
const cleanup = [];

beforeEach(() => {
  apiFetch.mockResolvedValue({ guildId, configuredGuildId: null, roleIds: [], enabled: false });
});
afterEach(() => { cleanup.splice(0).forEach((fn) => fn()); vi.resetAllMocks(); });

async function mount(props = {}) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<DiscordRoleAccess teamId="team-a" metadata={metadata} canManage {...props} />); });
  cleanup.push(() => act(() => renderer.unmount()));
  return renderer;
}
function text(node) { return typeof node === "string" ? node : (node.children || []).map(text).join(""); }
function button(renderer, label) { return renderer.root.findAllByType("button").find((node) => text(node) === label); }
function posts() { return apiFetch.mock.calls.filter(([, options]) => options?.method === "POST").map(([path, options]) => [path, JSON.parse(options.body)]); }

describe("Discord role access settings", () => {
  it("lets a manager select and save only this team's Discord roles", async () => {
    const renderer = await mount();
    expect(text(renderer.root)).toContain("uniquement pour les commandes du bot de cette équipe");
    expect(text(renderer.root)).toContain("leur visibilité dépend des permissions des salons Discord");
    expect(button(renderer, "Enregistrer les rôles autorisés").props.disabled).toBe(true);
    const role = renderer.root.findAllByType("label").find((node) => text(node) === "@Joueurs").findByType("input");
    await act(async () => role.props.onChange());
    expect(button(renderer, "Enregistrer les rôles autorisés").props.disabled).toBe(false);
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    expect(posts()).toEqual([["team-discord-role-access", { teamId: "team-a", guildId, roleIds: [roleA] }]]);
  });

  it("shows the active rule to staff without offering changes", async () => {
    apiFetch.mockResolvedValue({ guildId, configuredGuildId: guildId, roleIds: [roleB], enabled: true });
    const renderer = await mount({ canManage: false });
    expect(text(renderer.root)).toContain("@Staff");
    expect(button(renderer, "Enregistrer les rôles autorisés")).toBeUndefined();
    expect(button(renderer, "Supprimer la restriction par rôles")).toBeUndefined();
    expect(posts()).toEqual([]);
  });

  it("keeps a policy for a previous server locked until explicit confirmation", async () => {
    let policy = { guildId, configuredGuildId: "100000000000000099", roleIds: [roleB], enabled: true };
    apiFetch.mockImplementation(async (_path, options) => {
      if (options?.method === "POST") { policy = { guildId, configuredGuildId: null, roleIds: [], enabled: false }; return policy; }
      return policy;
    });
    const renderer = await mount();
    expect(text(renderer.root)).toContain("Les commandes de l’équipe restent bloquées");
    expect(button(renderer, "Enregistrer les rôles autorisés").props.disabled).toBe(true);
    await act(async () => button(renderer, "Supprimer la restriction par rôles").props.onClick());
    expect(posts()).toEqual([]);
    await act(async () => button(renderer, "Confirmer la suppression").props.onClick());
    expect(posts()).toEqual([["team-discord-role-access", { teamId: "team-a", guildId, roleIds: [] }]]);
    expect(text(renderer.root)).toContain("Aucun rôle Discord supplémentaire n’est exigé actuellement");
  });

  it("does not allow edits when Discord roles cannot be verified", async () => {
    apiFetch.mockResolvedValue({ guildId, configuredGuildId: guildId, roleIds: [roleA], enabled: true });
    const renderer = await mount({ metadata: { ...metadata, health: { verified: false }, roles: [] } });
    expect(text(renderer.root)).toContain("Impossible de modifier les rôles");
    expect(button(renderer, "Supprimer la restriction par rôles").props.disabled).toBe(true);
    expect(button(renderer, "Enregistrer les rôles autorisés").props.disabled).toBe(true);
    expect(posts()).toEqual([]);
  });
});
