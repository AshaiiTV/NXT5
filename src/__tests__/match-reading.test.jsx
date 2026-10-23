import React from 'react';
import './helpers/i18n.js';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../i18n/locale.js';
import MatchGoldChart from '../components/games/MatchGoldChart.jsx';
import { MatchKillMap } from '../components/games/MatchKillMap.jsx';
import {
  MatchDataPanel, MatchTimelineReview, DeathContextPanel, DraftImpactPanel,
} from '../pages/workspace/GameWorkspace.jsx';

const renderers = [];
const mount = element => {
  let renderer;
  act(() => { renderer = TestRenderer.create(element, {
    createNodeMock: node => node.type === 'svg' ? { getBoundingClientRect: () => ({ left: 100, width: 560 }) } : null,
  }); });
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
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(1);
    expect(byClass(renderer, 'match-timeline-checkpoints')).toHaveLength(0);
    expect(byClass(renderer, 'match-timeline-line')).toHaveLength(0);
    expect(byClass(renderer, 'match-gold-chart-sample')).toHaveLength(0);
    expect(text(renderer.root)).toContain('Courbe d’or indisponible');
    expect(text(renderer.root)).toContain('Chronologie indisponible');
  });

  it('uses compact events without inventing gold samples', () => {
    const game = match({ raw: { nxt5: { timelineEvents: [monster(300000), monster(600000, 6)], timelineSummary: { available: true } } } });
    const renderer = mount(<MatchTimelineReview match={game} />);
    expect(renderer.root.findAllByType('article')).toHaveLength(2);
    expect(byClass(renderer, 'match-timeline-line')).toHaveLength(0);
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(1);
    expect(byClass(renderer, 'match-gold-chart-sample')).toHaveLength(0);
    expect(text(renderer.root)).toContain('Aucun relevé d’or enregistré');
    expect(byClass(renderer, 'match-timeline-event-stats').map(node => text(node.findAllByType('dd')[0]))).toEqual(['—', '—']);
    expect(text(renderer.root)).toContain('Chronologie résumée');
  });

  it('uses the shared curve gaps and keeps only actual samples in a single accessible table', () => {
    const frames = [goldFrame(0), goldFrame(60000), goldFrame(120000, { missing: true }), goldFrame(180000), goldFrame(240000), goldFrame(420000), goldFrame(480000)];
    const renderer = mount(<MatchTimelineReview match={match({ raw: { timeline: { info: { frames } } } })} />);
    const lines = byClass(renderer, 'match-gold-chart-line');
    expect(lines).toHaveLength(3);
    expect(lines.every(node => node.props.points.trim().split(/\s+/).length === 2)).toBe(true);
    expect(lines.map(node => node.props['data-tone'])).toEqual(['neutral', 'neutral', 'neutral']);
    expect(byClass(renderer, 'match-gold-chart-sample')).toHaveLength(6);
    expect(renderer.root.findAllByType('table')).toHaveLength(1);
    const rows = renderer.root.findByType('tbody').findAllByType('tr');
    expect(rows.map(node => text(node.findByType('th')))).toEqual(['0:00', '1:00', '3:00', '4:00', '7:00', '8:00']);
    expect(rows.map(node => text(node.findByType('td')))).toEqual(['0', '0', '0', '0', '0', '0']);
    expect(text(renderer.root)).toContain('Relevés incomplets');
    expect(byClass(renderer, 'match-timeline-readings')).toHaveLength(0);
    expect(byClass(renderer, 'match-timeline-checkpoints')).toHaveLength(0);
  });

  it('reuses the recap chart and the exact publication when switching to chronology', () => {
    const frames = [goldFrame(0, { allyGold: 900 }), goldFrame(60000, { allyGold: 1200 }), goldFrame(120000, { allyGold: 800 })];
    const game = match({ duration: '2:00', opponent: 'Rivals', raw: { timeline: { info: { frames } } } });
    const renderer = mount(<MatchDataPanel match={game} teamName="Atlas" draftContent={<span />} />);
    const recapChart = renderer.root.findByType(MatchGoldChart);
    const publication = recapChart.props.publication;
    const recapLines = byClass(renderer, 'match-gold-chart-line').map(node => ({ tone: node.props['data-tone'], points: node.props.points }));
    const recapLegend = text(byClass(renderer, 'match-gold-chart-legend')[0]);
    act(() => renderer.root.findAllByProps({ role: 'tab' }).find(node => text(node) === 'Chronologie').props.onClick());
    expect(renderer.root.findAllByType(MatchGoldChart)).toHaveLength(1);
    expect(renderer.root.findByType(MatchGoldChart).props.publication).toBe(publication);
    expect(renderer.root.findByType(MatchGoldChart).props.match).toBe(game);
    expect(byClass(renderer, 'match-gold-chart-line').map(node => ({ tone: node.props['data-tone'], points: node.props.points }))).toEqual(recapLines);
    expect(recapLines.some(line => line.tone === 'positive')).toBe(true);
    expect(recapLines.some(line => line.tone === 'negative')).toBe(true);
    expect(text(byClass(renderer, 'match-gold-chart-legend')[0])).toBe(recapLegend);
    expect(byClass(renderer, 'match-gold-chart-stop-positive')).toHaveLength(1);
    expect(byClass(renderer, 'match-gold-chart-stop-negative')).toHaveLength(1);
    expect(renderer.root.findAllByType(MatchKillMap)).toHaveLength(1);
    expect(byClass(renderer, 'match-timeline-journal')).toHaveLength(1);
    for (const legacy of ['match-timeline-chart', 'match-timeline-plot', 'match-timeline-checkpoints', 'match-timeline-readings']) {
      expect(byClass(renderer, legacy)).toHaveLength(0);
    }
    expect(renderer.root.findAllByType('table')).toHaveLength(1);
  });

  it('allows whole-frame hover and keyboard sample inspection through the chronology view', () => {
    const frames = [goldFrame(0), goldFrame(60000, { allyGold: 1200 }), goldFrame(120000, { allyGold: 800 })];
    const game = match({ duration: '2:00', raw: { timeline: { info: { frames } } } });
    const renderer = mount(<MatchTimelineReview match={game} teamName="Atlas" enemyName="Rivals" />);
    const plot = () => byClass(renderer, 'match-gold-chart-plot')[0];
    const readout = () => byClass(renderer, 'match-gold-chart-readout')[0];
    expect(plot().props.role).toBe('slider');
    for (const clientY of [-300, 900]) {
      act(() => plot().props.onPointerMove({ clientX: 380, clientY, pointerType: 'mouse' }));
      expect(text(readout())).toContain('Relevé à 1:00');
      expect(text(readout())).toContain('+1\u202f000');
      expect(readout().findAllByType('b').map(text)).toEqual(['6\u202f000 or', '5\u202f000 or']);
      expect(byClass(renderer, 'match-gold-chart-selected')[0].props['data-tone']).toBe('positive');
    }
    act(() => plot().props.onFocus());
    for (const [key, index, time, tone] of [['Home', 0, '0:00', 'neutral'], ['ArrowRight', 1, '1:00', 'positive'], ['End', 2, '2:00', 'negative']]) {
      const preventDefault = vi.fn();
      act(() => plot().props.onKeyDown({ key, preventDefault }));
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(plot().props['aria-valuenow']).toBe(index);
      expect(text(readout())).toContain(`Relevé à ${time}`);
      expect(byClass(renderer, 'match-gold-chart-selected')[0].props['data-tone']).toBe(tone);
    }
    expect(plot().props['aria-valuetext']).toContain('Atlas');
    expect(plot().props['aria-valuetext']).toContain('Rivals');
  });

  it('preserves a lone measured zero and rejects incomplete participant identities in chronology', () => {
    const game = match({ raw: { timeline: { info: { frames: [goldFrame(60000)] } } } });
    const renderer = mount(<MatchTimelineReview match={game} />);
    expect(byClass(renderer, 'match-gold-chart-sample')).toHaveLength(1);
    expect(byClass(renderer, 'match-gold-chart-sample')[0].props['data-tone']).toBe('neutral');
    expect(byClass(renderer, 'match-gold-chart-line')).toHaveLength(0);
    expect(text(renderer.root.findByType('tbody'))).toBe('1:000');
    act(() => renderer.update(<MatchTimelineReview match={{ ...game, participants: game.participants.slice(1) }} />));
    expect(byClass(renderer, 'match-gold-chart-sample')).toHaveLength(0);
    expect(byClass(renderer, 'match-gold-chart-plot')).toHaveLength(0);
    expect(text(renderer.root)).toContain('Participants incomplets ou non identifiables');
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

  it('keeps drafting independent of missing final damage statistics', () => {
    const game = match();
    delete game.participants[0].gold;
    delete game.participants[0].damage;
    delete game.participants[0].raw.magicDamageDealtToChampions;
    const draft = mount(<DraftImpactPanel match={game} />);
    expect(byClass(draft, 'match-damage-bar')).toHaveLength(0);
    expect(text(draft.root)).not.toContain('%');
    expect(text(draft.root)).toContain('La leur');
    expect(text(draft.root)).toContain('La nôtre');
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

  it('does not display recorded zero damage as a drafting measurement', () => {
    const game = match();
    game.participants.forEach(row => Object.assign(row.raw, { physicalDamageDealtToChampions: 0, magicDamageDealtToChampions: 0, trueDamageDealtToChampions: 0 }));
    const renderer = mount(<DraftImpactPanel match={game} />);
    expect(byClass(renderer, 'match-damage-bar')).toHaveLength(0);
    expect(text(renderer.root)).toContain('Plan possible');
    expect(text(renderer.root)).not.toContain('%');
    expect(text(renderer.root)).not.toContain('0 dégât');
    expect(text(renderer.root)).not.toContain('NaN');
  });

  it('does not expose nested final damage data in the drafting reading', () => {
    const game = match();
    game.participants.filter(row => row.team_key === 'ALLY').forEach(row => {
      row.raw = JSON.stringify({ stats: { physicalDamageDealtToChampions: 12000, magicDamageDealtToChampions: 6000, trueDamageDealtToChampions: 2000 } });
    });
    const renderer = mount(<DraftImpactPanel match={game} />);
    expect(byClass(renderer, 'match-damage-legend')).toHaveLength(0);
    expect(text(renderer.root)).not.toContain('%');
    expect(text(renderer.root)).toContain('Plan possible');
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
