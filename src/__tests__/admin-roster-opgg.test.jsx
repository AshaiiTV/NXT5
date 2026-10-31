import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminRosterOpgg from '../pages/admin/AdminRosterOpgg.jsx';
import { Button } from '../components/ui/Core.jsx';

const renderers = [];
const player = (id, role = 'TOP', extra = {}) => ({ id, name: id, role, riot_id: `${id}#TEST`, roster_status: 'MAIN', ...extra });
const team = (mainRoster, extra = {}) => ({ id: 'team', name: 'Équipe test', region: 'EUW', mainRoster, ...extra });
const content = renderer => JSON.stringify(renderer.toJSON());
const button = renderer => renderer.root.findByType(Button);
async function render(value, disabled = false) {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<AdminRosterOpgg team={value} disabled={disabled} />); });
  renderers.push(renderer);
  return renderer;
}
beforeEach(() => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  renderers.splice(0).forEach(renderer => act(() => renderer.unmount()));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin starting roster OP.GG copy', () => {
  it('copies the correct region and encoded Riot IDs without substitutes, inactive players or staff', async () => {
    const renderer = await render(team([
      player('Éclair Bleu', 'TOP'), player('Jungler', 'JGL'), player('Mid', 'MID'), player('Carry', 'ADC'), player('Support', 'SUP'),
      player('Sub', 'SUB'), player('Reserve', 'TOP', { roster_status: 'SUB' }),
      player('Inactive', 'MID', { roster_status: 'INACTIVE' }), player('Coach', 'COACH'),
    ], { region: 'NA' }));
    await act(async () => button(renderer).props.onClick());
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    const url = new URL(navigator.clipboard.writeText.mock.calls[0][0]);
    expect(url.origin).toBe('https://www.op.gg');
    expect(url.pathname).toBe('/lol/multisearch/na');
    expect(url.searchParams.get('summoners')).toBe('Éclair Bleu#TEST,Jungler#TEST,Mid#TEST,Carry#TEST,Support#TEST');
    expect(content(renderer)).toContain('Copié');
  });

  it('copies valid identifiers and clearly indicates an incomplete link', async () => {
    const renderer = await render(team([player('Valid'), player('Missing', 'MID', { riot_id: '' }), player('Invalid', 'SUP', { riot_id: 'WithoutTag' })]));
    expect(content(renderer)).toContain('1/3 titulaires dans le lien');
    await act(async () => button(renderer).props.onClick());
    expect(new URL(navigator.clipboard.writeText.mock.calls[0][0]).searchParams.get('summoners')).toBe('Valid#TEST');
    expect(content(renderer)).toContain('Lien copié · 1/3 titulaires inclus');
  });

  it.each([
    [[], 'Aucun titulaire dans cette équipe.'],
    [[player('No ID', 'TOP', { riot_id: '' })], 'Renseigne les Riot IDs des titulaires au format Pseudo#TAG.'],
    [[player('Coach', 'COACH')], 'Aucun titulaire dans cette équipe.'],
  ])('disables copy with an explanation when no link exists', async (roster, message) => {
    const renderer = await render(team(roster));
    expect(button(renderer).props.disabled).toBe(true);
    expect(content(renderer)).toContain(message);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('offers a selectable fallback and allows retry after clipboard denial', async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Permission denied'));
    const renderer = await render(team([player('Valid')]));
    await act(async () => button(renderer).props.onClick());
    expect(content(renderer)).toContain('Copie impossible. Réessaie ou copie le lien ci-dessous.');
    const fallback = renderer.root.findByType('input');
    expect(fallback.props.readOnly).toBe(true);
    expect(new URL(fallback.props.value).searchParams.get('summoners')).toBe('Valid#TEST');
    await act(async () => button(renderer).props.onClick());
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByType('input')).toHaveLength(0);
    expect(content(renderer)).toContain('Copié');
  });

  it('handles an unavailable clipboard API without claiming success', async () => {
    vi.stubGlobal('navigator', {});
    const renderer = await render(team([player('Valid')]));
    await act(async () => button(renderer).props.onClick());
    expect(content(renderer)).toContain('Copie impossible. Réessaie ou copie le lien ci-dessous.');
    expect(renderer.root.findByType('input').props.readOnly).toBe(true);
  });

  it.each(['team', 'roster'])('ignores a delayed copy after the %s changes and allows copying the current team', async change => {
    let finishOld, finishCurrent, oldCopy, currentCopy;
    navigator.clipboard.writeText
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishCurrent = resolve; }));
    const original = team([player('Original')]);
    const renderer = await render(original);
    act(() => { oldCopy = button(renderer).props.onClick(); });
    expect(button(renderer).props.disabled).toBe(true);
    const current = change === 'team' ? { ...original, id: 'other-team', name: 'Autre équipe' } : team([player('Updated')]);
    await act(async () => renderer.update(<AdminRosterOpgg team={current} />));
    expect(button(renderer).props.disabled).toBe(false);
    act(() => { currentCopy = button(renderer).props.onClick(); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    await act(async () => { finishOld(); await oldCopy; });
    expect(button(renderer).props.disabled).toBe(true);
    expect(button(renderer).props.children).toBe('Copie…');
    // Finishing the old operation must not unlock or complete the current one.
    await act(async () => button(renderer).props.onClick());
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    await act(async () => { finishCurrent(); await currentCopy; });
    expect(button(renderer).props.children).toBe('Copié');
    expect(new URL(navigator.clipboard.writeText.mock.calls[1][0]).searchParams.get('summoners')).toBe(change === 'team' ? 'Original#TEST' : 'Updated#TEST');
  });

  it('respects the dossier busy state', async () => {
    const renderer = await render(team([player('Valid')]), true);
    expect(button(renderer).props.disabled).toBe(true);
  });
});
