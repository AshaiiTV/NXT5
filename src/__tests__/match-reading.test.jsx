import React from 'react';
import './helpers/i18n.js';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n/locale.js';
import {
  MatchTimelineReview, TimelineGoldCheckpoint, DeathContextPanel, DraftImpactPanel,
} from '../pages/workspace/GameWorkspace.jsx';

const renderers = [];
const mount = element => {
  let renderer;
  act(() => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
};
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
const byClass = (renderer, name) => renderer.root.findAll(node => typeof node.type === 'string' && String(node.props.className || '').split(' ').includes(name));
afterEach(() => { act(() => { renderers.splice(0).forEach(renderer => renderer.unmount()); setLanguage('fr'); }); });
const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const monster = (timestamp, killerId = 1) => ({ type: 'ELITE_MONSTER_KILL', timestamp, monsterType: 'DRAGON', killerId });
const goldFrame = (timestamp, { missing = false, allyGold = 1000 } = {}) => ({
  timestamp, events: [], participantFrames: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), {
    ...(missing && i === 2 ? {} : { totalGold: i < 5 ? allyGold : 1000 }), minionsKilled: 50, jungleMinionsKilled: 10,
  }])),
});
function match(overrides = {}) {
  return {
    id: 'reading-one', duration: '27:00', result: 'Victoire', side: 'blue', raw: {},
    participants: ['ALLY', 'ENEMY'].flatMap((teamKey, side) => roles.map((role, i) => ({
      id: `participant-${side * 5 + i + 1}`, team_key: teamKey, role, champion: 'Ahri', summoner_name: side ? `Rival ${role}` : `Joueur ${role}`,
      kills: 2, deaths: 2, assists: 3, gold: 10000, damage: 15000, vision: 20, cs: 120, kill_participation: 50,
      raw: { participantId: side * 5 + i + 1, teamId: side ? 200 : 100, physicalDamageDealtToChampions: 1000, magicDamageDealtToChampions: 14000, trueDamageDealtToChampions: 0 },
    }))),
    ...overrides,
  };
}

describe('match detail reading data contracts', () => {
  it('keeps missing chronology unavailable without repeating final statistics', () => {
    const renderer = mount(<MatchTimelineReview match={match()} teamName="Notre équipe fictive" />);
    expect(text(renderer.root)).not.toContain('Écart d’or final');
    expect(text(renderer.root)).not.toContain('Objectifs neutres relevés');
    expect(renderer.root.findAllByType(TimelineGoldCheckpoint).every(node => node.props.diff === null)).toBe(true);
    expect(byClass(renderer, 'match-timeline-line')).toHaveLength(0);
    expect(text(renderer.root)).toContain('Courbe indisponible');
    expect(text(renderer.root)).toContain('Chronologie indisponible');
  });

  it('uses compact events without inventing gold samples', () => {
    const game = match({ raw: { nxt5: { timelineEvents: [monster(300000), monster(600000, 6)], timelineSummary: { available: true } } } });
    const renderer = mount(<MatchTimelineReview match={game} />);
    expect(renderer.root.findAllByType('article')).toHaveLength(2);
    expect(byClass(renderer, 'match-timeline-line')).toHaveLength(0);
    expect(byClass(renderer, 'match-timeline-event-stats').map(node => text(node.findAllByType('dd')[0]))).toEqual(['—', '—']);
    expect(text(renderer.root)).toContain('Chronologie résumée');
  });

  it('breaks the economy graph at absent values and gaps longer than two minutes', () => {
    const frames = [goldFrame(0), goldFrame(60000), goldFrame(120000, { missing: true }), goldFrame(180000), goldFrame(240000), goldFrame(420000), goldFrame(480000)];
    const renderer = mount(<MatchTimelineReview match={match({ raw: { timeline: { info: { frames } } } })} />);
    const positivePaths = byClass(renderer, 'match-timeline-line').filter(node => node.props.className.includes('is-positive'));
    expect(positivePaths).toHaveLength(3);
    expect(positivePaths.every(node => (node.props.d.match(/L/g) || []).length === 1)).toBe(true);
    expect(byClass(renderer, 'match-timeline-dot')).toHaveLength(6);
    const values = byClass(renderer, 'match-timeline-readings-list')[0].findAllByType('dd').map(text);
    expect(values.filter(value => value === 'Indisponible')).toHaveLength(1);
    expect(values.filter(value => value === '+0 or')).toHaveLength(6);
  });

  it('makes every milestone accessible, filters phases, and resets the filter for a different match', () => {
    const events = [...Array.from({ length: 8 }, (_, i) => monster((i + 1) * 60000)), monster(18 * 60000), monster(25 * 60000)];
    const game = match({ raw: { nxt5: { timelineEvents: events } } });
    const renderer = mount(<MatchTimelineReview match={game} />);
    const filter = () => renderer.root.findByProps({ 'aria-label': 'Filtrer les moments par phase' }).findAllByType('button');
    expect(renderer.root.findAllByType('article')).toHaveLength(10);
    act(() => filter()[1].props.onClick());
    expect(filter()[1].props['aria-pressed']).toBe(true);
    expect(renderer.root.findAllByType('article')).toHaveLength(8);
    act(() => filter()[3].props.onClick());
    expect(renderer.root.findAllByType('article')).toHaveLength(1);
    expect(text(renderer.root.findByType('article'))).toContain('25:00');
    act(() => renderer.update(<MatchTimelineReview match={{ ...game, id: 'reading-two' }} />));
    expect(filter()[0].props['aria-pressed']).toBe(true);
    expect(renderer.root.findAllByType('article')).toHaveLength(10);
  });

  it('does not fabricate damage proportions for incomplete participants', () => {
    const game = match();
    delete game.participants[0].gold;
    delete game.participants[0].damage;
    delete game.participants[0].raw.magicDamageDealtToChampions;
    const draft = mount(<DraftImpactPanel match={game} />);
    expect(byClass(draft, 'match-damage-bar')).toHaveLength(0);
    expect(text(draft.root)).toContain('Aucun pourcentage n’est estimé');
  });

  it('requires death events to derive context instead of treating missing chronology as zero', () => {
    const renderer = mount(<DeathContextPanel match={match()} />);
    expect(byClass(renderer, 'match-death-figures')[0].findAllByType('dd').map(text)).toEqual(['—', '—']);
    expect(text(byClass(renderer, 'match-death-hypothesis-value')[0])).toBe('—');
    const game = match({ raw: { timeline: { info: { frames: [goldFrame(600000)] } } } });
    game.participants.forEach(row => { row.deaths = 0; });
    act(() => renderer.update(<DeathContextPanel match={game} />));
    expect(byClass(renderer, 'match-death-figures')[0].findAllByType('dd').map(text)).toEqual(['0', '0']);
  });

  it('does not infer an isolated death when the assisting participants were not recorded', () => {
    const death = { type: 'CHAMPION_KILL', timestamp: 590000, killerId: 6, victimId: 1, shutdownBounty: 0 };
    const game = match({ raw: { nxt5: { timelineEvents: [death, monster(600000, 6)] } } });
    const renderer = mount(<DeathContextPanel match={game} />);
    expect(byClass(renderer, 'match-death-figures')[0].findAllByType('dd').map(text)).toEqual(['1', '0']);
    expect(text(byClass(renderer, 'match-death-hypothesis-value')[0])).toBe('—');
    expect(text(renderer.root)).toContain('hypothèse non chiffrée');
  });

  it('distinguishes zero recorded damage from missing damage without drawing invalid proportions', () => {
    const game = match();
    game.participants.forEach(row => Object.assign(row.raw, { physicalDamageDealtToChampions: 0, magicDamageDealtToChampions: 0, trueDamageDealtToChampions: 0 }));
    const renderer = mount(<DraftImpactPanel match={game} />);
    expect(byClass(renderer, 'match-damage-bar')).toHaveLength(0);
    expect(text(renderer.root)).toContain('Les cinq joueurs ont 0 dégât renseigné');
    expect(text(renderer.root)).not.toContain('La répartition des dégâts n’est pas disponible');
    expect(text(renderer.root)).not.toContain('NaN');
  });

  it('reads aliased damage from nested raw data without estimating a missing player', () => {
    const game = match();
    game.participants.filter(row => row.team_key === 'ALLY').forEach(row => {
      row.raw = JSON.stringify({ stats: { physicalDamageDealtToChampions: 12000, magicDamageDealtToChampions: 6000, trueDamageDealtToChampions: 2000 } });
    });
    const renderer = mount(<DraftImpactPanel match={game} />);
    const values = byClass(renderer, 'match-damage-legend')[0].findAllByType('strong').map(text);
    expect(values).toEqual(['60%', '30%', '10%']);
  });

  it.each(['en', 'es'])('preserves player and team names matching product translations in %s', async language => {
    await act(async () => setLanguage(language));
    const game = match({ raw: { nxt5: { timelineEvents: [{ type: 'CHAMPION_KILL', timestamp: 590000, killerId: 6, victimId: 1, assistingParticipantIds: [], shutdownBounty: 0 }, monster(600000)] } } });
    game.participants[0].summoner_name = 'Paramètres';
    const deathsRenderer = mount(<DeathContextPanel match={game} />);
    expect(text(byClass(deathsRenderer, 'match-death-focus')[0])).toContain('Paramètres');
    const timeline = mount(<MatchTimelineReview match={game} teamName="Accueil" />);
    expect(text(byClass(timeline, 'match-timeline-event-team')[0])).toBe('Accueil');
  });
});
