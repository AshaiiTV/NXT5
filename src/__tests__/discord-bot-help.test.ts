import { describe, expect, it } from 'vitest';
import { discordCommandCatalog, discordLegacyCommandCatalog, discordCommandCategories, discordHelpSections, nxtDiscordCommand } from '../../shared/discord-command.js';
import { buildDiscordHelp, resolveDiscordHelpInteraction } from '../../shared/discord-help.js';

const visiblePaths = ['help', 'lier', 'profil', 'voir', 'connecter'];
const length = (value: string) => Array.from(value).length;
function commandSize(node: any): number {
  return length(node.name || '') + length(node.description || '') + (typeof node.value === 'string' ? length(node.value) : 0)
    + (node.options || []).reduce((sum: number, child: any) => sum + commandSize(child), 0)
    + (node.choices || []).reduce((sum: number, child: any) => sum + commandSize(child), 0);
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

describe('NXT5 visible Discord command contract', () => {
  it('registers only five flat commands while preserving the previous catalogue for parsing', () => {
    const root = nxtDiscordCommand();
    expect(root.default_member_permissions).toBeNull();
    expect(root.contexts).toEqual([0]);
    expect(root.integration_types).toEqual([0]);
    expect(root.options.map((option: any) => option.name)).toEqual(visiblePaths);
    expect(root.options.every((option: any) => option.type === 1)).toBe(true);
    expect(discordCommandCatalog.map((entry: any) => entry.path)).toEqual(visiblePaths);
    expect(discordLegacyCommandCatalog).toHaveLength(50);
    expect(discordLegacyCommandCatalog.some((entry: any) => entry.path === 'equipe choisir')).toBe(true);
  });

  it('fits Discord schema, choice and required-option constraints', () => {
    const root = nxtDiscordCommand();
    expect(root.options.length).toBeLessThanOrEqual(25);
    expect(commandSize(root)).toBeLessThanOrEqual(8000);
    const check = (node: any) => {
      expect(node.name).toMatch(/^[a-z][a-z_]{0,31}$/);
      expect(length(node.description)).toBeGreaterThan(0);
      expect(length(node.description)).toBeLessThanOrEqual(100);
      if (node.options) {
        expect(node.options.length).toBeLessThanOrEqual(25);
        expect(new Set(node.options.map((option: any) => option.name)).size).toBe(node.options.length);
        let optional = false;
        for (const option of node.options) {
          if (!option.required) optional = true;
          if (option.required) expect(optional).toBe(false);
          check(option);
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

  it('requires a subject for voir and keeps the installation code validation', () => {
    const options = nxtDiscordCommand().options;
    expect(options.find((item: any) => item.name === 'voir').options).toEqual([
      expect.objectContaining({
        name: 'sujet', type: 3, required: true,
        choices: [
          { name: 'Dernière game', value: 'derniere' }, { name: 'Bilan', value: 'bilan' },
          { name: 'Statistiques', value: 'stats' }, { name: 'Planning', value: 'planning' },
          { name: 'Objectifs', value: 'objectifs' }, { name: 'Reviews', value: 'reviews' },
          { name: 'Draft', value: 'draft' },
        ],
      }),
    ]);
    expect(options.find((item: any) => item.name === 'connecter').options).toEqual([
      expect.objectContaining({ name: 'code', type: 3, required: true, min_length: 16, max_length: 24 }),
    ]);
    expect(options.find((item: any) => item.name === 'help').options.map((option: any) => [option.name, option.required])).toEqual([['rubrique', false], ['commande', false]]);
  });

  it('returns independent schemas for setup comparison', () => {
    const first = nxtDiscordCommand();
    first.options[0].options[0].choices[0].name = 'Changed';
    expect(nxtDiscordCommand().options[0].options[0].choices[0].name).toBe('Démarrer');
  });
});

describe('Private Discord help content and navigation', () => {
  it.each(discordHelpSections.map((section: any) => section.id))('renders tutorial page %s within Discord limits', (page) => {
    const result = buildDiscordHelp({ page });
    assertMessageLimits(result);
    expect(result.embeds[0].footer.text).toContain('/3');
    expect(result.embeds[0].footer.text).toContain('Visible uniquement par toi');
  });

  it('completes the tutorial and returns home with stateless button routes', () => {
    let result = buildDiscordHelp();
    expect(result.components[0].components[0].disabled).toBe(true);
    expect(result.components[0].components[1].disabled).toBe(true);
    for (let index = 1; index < discordHelpSections.length; index++) {
      const next = result.components[0].components.find((item: any) => item.label === 'Suivant');
      expect(next.disabled).toBe(false);
      const target = resolveDiscordHelpInteraction(next.custom_id);
      expect(target).toEqual({ page: discordHelpSections[index].id });
      result = buildDiscordHelp(target!);
    }
    expect(result.components[0].components.find((item: any) => item.label === 'Suivant').disabled).toBe(true);
    const home = result.components[0].components.find((item: any) => item.label === 'Accueil');
    expect(buildDiscordHelp(resolveDiscordHelpInteraction(home.custom_id)!).embeds[0].title).toBe('NXT5 dans le salon de ton équipe');
  });

  it.each(discordCommandCategories.map((category: any) => category.id))('renders catalogue %s using visible commands only', (category) => {
    const result = buildDiscordHelp({ page: 'catalogue:' + category });
    assertMessageLimits(result);
    for (const item of result.embeds[0].fields) expect(visiblePaths).toContain(item.name.replace('/nxt ', ''));
  });

  it('covers every visible command and no previous command in the catalogue', () => {
    const advertised = discordCommandCategories.flatMap(category => buildDiscordHelp({ page: 'catalogue:' + category.id }).embeds[0].fields.map((item: any) => item.name.replace('/nxt ', '')));
    expect(advertised.sort()).toEqual([...visiblePaths].sort());
    for (const entry of discordCommandCatalog) {
      const result = buildDiscordHelp({ command: entry.path });
      expect(result.embeds[0].title).toBe('/nxt ' + entry.path);
      assertMessageLimits(result);
      const text = JSON.stringify(result.embeds);
      for (const option of entry.options) expect(text).toContain(option.name);
    }
    expect(JSON.stringify(buildDiscordHelp({ page: 'catalogue:joueur' }))).not.toContain('equipe choisir');
  });

  it('teaches the channel-based team context and private personal responses', () => {
    const welcome = JSON.stringify(buildDiscordHelp().embeds);
    expect(welcome).toContain('/nxt lier');
    expect(welcome).toContain('/nxt voir sujet:derniere');
    expect(welcome).toContain('aucun nom d’équipe ni identifiant');
    const player = JSON.stringify(buildDiscordHelp({ page: 'joueur' }).embeds);
    expect(player).toContain('informations d’équipe');
    expect(player).toContain('uniquement par toi');
    const install = JSON.stringify(buildDiscordHelp({ page: 'responsable' }).embeds);
    expect(install).toContain('un seul salon');
    expect(install).toContain('/nxt connecter code:<code>');
  });

  it('finds normalized command names without advertising obsolete commands', () => {
    expect(buildDiscordHelp({ command: ' /NXT   VOIR ' }).embeds[0].title).toBe('/nxt voir');
    expect(buildDiscordHelp({ command: 'compte lier' }).embeds[0].fields[0].name).toBe('Commande introuvable');
  });

  it('does not reflect unknown names or resolve forged custom IDs', () => {
    const untrusted = '@everyone <@1234> `secret-team-token`';
    const result = buildDiscordHelp({ page: untrusted, command: untrusted });
    expect(JSON.stringify(result)).not.toContain(untrusted);
    expect(result.embeds[0].fields[0].name).toBe('Commande introuvable');
    for (const customId of ['nxt:help:page:private-team', 'nxt:help:catalogue:unknown', 'nxt:confirm:secret', 'nxt:help:page:accueil:unexpected', 'nxt:help:select']) {
      expect(resolveDiscordHelpInteraction(customId)).toBeNull();
    }
    expect(resolveDiscordHelpInteraction('nxt:help:select', ['page:accueil', 'page:joueur'])).toBeNull();
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
