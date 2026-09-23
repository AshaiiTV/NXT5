import { describe, expect, it } from 'vitest';
import { discordCommandCatalog, discordCommandCategories, discordHelpSections, nxtDiscordCommand } from '../../shared/discord-command.js';
import { buildDiscordHelp, resolveDiscordHelpInteraction } from '../../shared/discord-help.js';

const expectedPaths = [
  'help', 'aide', 'compte lier', 'compte profil', 'compte delier', 'equipe liste', 'equipe choisir',
  'derniere', 'game voir', 'game chercher', 'game comparer', 'bilan', 'stats equipe', 'stats tendance', 'reglages bilan',
  'joueur profil', 'joueur stats', 'joueur comparer', 'objectifs liste', 'objectifs definir', 'objectifs terminer', 'objectifs point',
  'pool voir', 'stats champions', 'pool suggerer', 'draft compositions', 'draft preparer', 'draft notes',
  'planning', 'evenement creer', 'evenement modifier', 'evenement annuler', 'presence repondre', 'presence liste', 'presence relancer', 'disponibilites definir',
  'review liste', 'review voir', 'review creer', 'review partager', 'review lire', 'review lectures',
  'connecter', 'statut', 'pause', 'reprendre', 'reglages canal', 'reglages rappels', 'reglages fuseau', 'diffusion test',
];
const length = (value: string) => Array.from(value).length;
function commandSize(node: any): number {
  return length(node.name || '') + length(node.description || '') + (typeof node.value === 'string' ? length(node.value) : 0)
    + (node.options || []).reduce((sum: number, child: any) => sum + commandSize(child), 0)
    + (node.choices || []).reduce((sum: number, child: any) => sum + commandSize(child), 0);
}
function registeredLeaves() {
  return nxtDiscordCommand().options.flatMap((option: any) => option.type === 2
    ? option.options.map((child: any) => ({ ...child, path: option.name + ' ' + child.name }))
    : [{ ...option, path: option.name }]);
}
function assertMessageLimits(message: any) {
  expect(message.allowed_mentions).toEqual({ parse: [] });
  expect(message.embeds).toHaveLength(1);
  // The router adds EPHEMERAL to the initial reply, not to UPDATE_MESSAGE.
  expect(message.flags).toBeUndefined();
  let total = 0;
  for (const embed of message.embeds) {
    expect(length(embed.title)).toBeLessThanOrEqual(256);
    expect(length(embed.description)).toBeLessThanOrEqual(4096);
    expect(embed.fields.length).toBeLessThanOrEqual(25);
    expect(length(embed.footer.text)).toBeLessThanOrEqual(2048);
    total += length(embed.title) + length(embed.description) + length(embed.footer.text);
    for (const field of embed.fields) {
      expect(length(field.name)).toBeLessThanOrEqual(256);
      expect(length(field.value)).toBeLessThanOrEqual(1024);
      total += length(field.name) + length(field.value);
    }
  }
  expect(total).toBeLessThanOrEqual(6000);
  expect(message.components.length).toBeLessThanOrEqual(5);
  const ids: string[] = [];
  for (const row of message.components) {
    expect(row.type).toBe(1);
    expect(row.components.length).toBeLessThanOrEqual(5);
    for (const item of row.components) {
      ids.push(item.custom_id);
      expect(length(item.custom_id)).toBeLessThanOrEqual(100);
      expect(item.custom_id.startsWith('nxt:help:')).toBe(true);
      if (item.type === 3) {
        expect(row.components).toHaveLength(1);
        expect(item.options.length).toBeLessThanOrEqual(25);
        expect(item.options.filter((option: any) => option.default)).toHaveLength(1);
        for (const option of item.options) {
          expect(length(option.label)).toBeLessThanOrEqual(100);
          expect(length(option.value)).toBeLessThanOrEqual(100);
          expect(length(option.description || '')).toBeLessThanOrEqual(100);
          expect(resolveDiscordHelpInteraction(item.custom_id, [option.value])).not.toBeNull();
        }
      } else {
        expect(item.type).toBe(2);
        expect(length(item.label)).toBeLessThanOrEqual(80);
        expect(resolveDiscordHelpInteraction(item.custom_id)).not.toBeNull();
      }
    }
  }
  expect(new Set(ids).size).toBe(ids.length);
}

describe('NXT5 registered command contract', () => {
  it('registers all fifty documented paths and opens the server-only root to members', () => {
    const root = nxtDiscordCommand();
    expect(root.default_member_permissions).toBeNull();
    expect(root.contexts).toEqual([0]);
    expect(root.integration_types).toEqual([0]);
    expect(registeredLeaves().map((item: any) => item.path).sort()).toEqual([...expectedPaths].sort());
    expect(new Set(registeredLeaves().map((item: any) => item.path)).size).toBe(50);
  });

  it('fits Discord schema, nesting, choice and required-option constraints', () => {
    const root = nxtDiscordCommand();
    expect(root.options.length).toBeLessThanOrEqual(25);
    // Discord counts name/description/value text, not JSON punctuation or keys.
    expect(commandSize(root)).toBeLessThanOrEqual(8000);
    const check = (node: any, depth = 0) => {
      expect(node.name).toMatch(/^[a-z][a-z_]{0,31}$/);
      expect(length(node.description)).toBeGreaterThan(0);
      expect(length(node.description)).toBeLessThanOrEqual(100);
      if (node.options) {
        expect(node.options.length).toBeLessThanOrEqual(25);
        expect(new Set(node.options.map((option: any) => option.name)).size).toBe(node.options.length);
        let optional = false;
        for (const option of node.options) {
          if (option.type <= 2) {
            expect(depth).toBeLessThanOrEqual(1);
            expect(option.required).toBeUndefined();
          } else {
            if (!option.required) optional = true;
            if (option.required) expect(optional).toBe(false);
          }
          check(option, depth + 1);
        }
      }
      if (node.choices) {
        expect(node.autocomplete).not.toBe(true);
        expect(node.choices.length).toBeLessThanOrEqual(25);
        for (const choice of node.choices) {
          expect(length(choice.name)).toBeLessThanOrEqual(100);
          expect(length(String(choice.value))).toBeLessThanOrEqual(100);
        }
      }
      if (node.type === 3) {
        expect(node.max_length).toBeLessThanOrEqual(6000);
        expect(node.min_length).toBeLessThanOrEqual(node.max_length);
      }
    };
    check(root);
  });

  it('preserves link-code validation and explicit optional team selection', () => {
    const leaves = registeredLeaves();
    expect(leaves.find((item: any) => item.path === 'connecter').options).toEqual([
      expect.objectContaining({ name: 'code', type: 3, required: true, min_length: 16, max_length: 24 }),
    ]);
    for (const path of ['statut', 'pause', 'reprendre']) {
      expect(leaves.find((item: any) => item.path === path).options).toEqual([
        expect.objectContaining({ name: 'equipe', type: 3, required: false, autocomplete: true }),
      ]);
    }
    const help = leaves.find((item: any) => item.path === 'help');
    expect(help.options.map((option: any) => [option.name, option.required])).toEqual([['rubrique', false], ['commande', false]]);
  });

  it('uses channel, boolean and bounded numeric options for mutations', () => {
    const leaves = registeredLeaves();
    expect(leaves.find((item: any) => item.path === 'review partager').options).toContainEqual(expect.objectContaining({ name: 'canal', type: 7, required: true, channel_types: [0, 5] }));
    expect(leaves.find((item: any) => item.path === 'reglages rappels').options).toContainEqual(expect.objectContaining({ name: 'actif', type: 5, required: true }));
    expect(leaves.find((item: any) => item.path === 'presence repondre').options).toContainEqual(expect.objectContaining({ name: 'retard', type: 4, min_value: 1, max_value: 1440 }));
    expect(leaves.find((item: any) => item.path === 'disponibilites definir').options.map((option: any) => option.name)).toEqual(['date', 'debut', 'fin']);
  });

  it('returns independent schemas so setup comparisons cannot mutate the catalogue', () => {
    const first = nxtDiscordCommand();
    first.options[0].options[0].choices[0].name = 'Changed';
    expect(nxtDiscordCommand().options[0].options[0].choices[0].name).toBe('Accueil');
  });
});

describe('Private Discord help content and navigation', () => {
  it.each(discordHelpSections.map((section: any) => section.id))('renders tutorial page %s within Discord limits', (page) => {
    const result = buildDiscordHelp({ page });
    assertMessageLimits(result);
    expect(result.embeds[0].footer.text).toContain('/6');
    expect(result.embeds[0].footer.text).toContain('Visible uniquement par toi');
  });

  it('can complete the tutorial and return home with stateless button routes', () => {
    let result = buildDiscordHelp();
    expect(result.components[0].components[0].disabled).toBe(true);
    expect(result.components[0].components[1].disabled).toBe(true);
    for (let index = 1; index < 6; index++) {
      const next = result.components[0].components.find((item: any) => item.label === 'Suivant');
      expect(next.disabled).toBe(false);
      const target = resolveDiscordHelpInteraction(next.custom_id);
      expect(target).toEqual({ page: discordHelpSections[index].id });
      result = buildDiscordHelp(target!);
    }
    expect(result.components[0].components.find((item: any) => item.label === 'Suivant').disabled).toBe(true);
    const home = result.components[0].components.find((item: any) => item.label === 'Accueil');
    expect(buildDiscordHelp(resolveDiscordHelpInteraction(home.custom_id)!).embeds[0].title).toBe('Bienvenue dans le bot NXT5');
  });

  it.each(discordCommandCategories.map((category: any) => category.id))('renders catalogue %s using registered commands only', (category) => {
    const result = buildDiscordHelp({ page: 'catalogue:' + category });
    assertMessageLimits(result);
    for (const field of result.embeds[0].fields) expect(expectedPaths).toContain(field.name.replace('/nxt ', ''));
  });

  it('covers all registered commands in the catalogue and gives every one a valid detail page', () => {
    const advertised = discordCommandCategories.flatMap(category => buildDiscordHelp({ page: 'catalogue:' + category.id }).embeds[0].fields.map((field: any) => field.name.replace('/nxt ', '')));
    expect(advertised.sort()).toEqual([...expectedPaths].sort());
    for (const entry of discordCommandCatalog) {
      const result = buildDiscordHelp({ command: entry.path });
      expect(result.embeds[0].title).toBe('/nxt ' + entry.path);
      assertMessageLimits(result);
      const text = JSON.stringify(result.embeds);
      for (const option of entry.options) expect(text).toContain(option.name);
    }
  });

  it('distinguishes personal linking from server installation without private context', () => {
    const welcome = JSON.stringify(buildDiscordHelp().embeds);
    expect(welcome).toContain('/nxt compte lier');
    expect(welcome).toContain('/nxt connecter code:<code>');
    expect(welcome).toContain('avant de lier ton compte');
    const install = JSON.stringify(buildDiscordHelp({ page: 'responsable' }).embeds);
    expect(install).toContain('/nxt statut equipe:<équipe>');
    expect(install).toContain('aucun accès supplémentaire');
  });

  it('finds exact commands, group commands and normalized slash input', () => {
    expect(buildDiscordHelp({ command: ' /NXT   BILAN ' }).embeds[0].title).toBe('/nxt bilan');
    expect(buildDiscordHelp({ command: 'review' }).embeds[0].fields.map((field: any) => field.name)).toEqual([
      '/nxt review liste', '/nxt review voir', '/nxt review creer', '/nxt review partager', '/nxt review lire', '/nxt review lectures',
    ]);
  });

  it('does not reflect unknown names or resolve forged custom IDs', () => {
    const untrusted = '@everyone <@1234> `secret-team-token`';
    const result = buildDiscordHelp({ page: untrusted, command: untrusted });
    expect(JSON.stringify(result)).not.toContain(untrusted);
    expect(result.embeds[0].fields[0].name).toBe('Commande introuvable');
    for (const customId of ['nxt:help:page:private-team', 'nxt:help:catalogue:unknown', 'nxt:confirm:secret', 'nxt:help:page:accueil:unexpected', 'nxt:help:select']) {
      expect(resolveDiscordHelpInteraction(customId)).toBeNull();
    }
    expect(resolveDiscordHelpInteraction('nxt:help:select', ['page:accueil', 'page:compte'])).toBeNull();
    expect(resolveDiscordHelpInteraction('nxt:help:select', ['page:accueil:home'])).toBeNull();
  });

  it('does not share mutable embed or menu state across users', () => {
    const first = buildDiscordHelp();
    first.embeds[0].fields[0].value = 'private content';
    first.components[1].components[0].options[0].label = 'private team';
    const second = buildDiscordHelp();
    expect(JSON.stringify(second)).not.toContain('private content');
    expect(JSON.stringify(second)).not.toContain('private team');
  });
});
