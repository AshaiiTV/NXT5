import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importDrafterDraft, parseDrafterHtml, parseDrafterUrl } from '../../netlify/functions/_lib/drafter-import';
import { draftOrder } from '../../shared/draft-order.js';

// Public hydration props fetched on 2026-10-12 from the user-supplied URL.
// Only draft/series fields are retained; ads, scripts and unrelated data removed.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/drafter-public-series.json', import.meta.url), 'utf8'));
const link = 'https://drafter.lol/draft/IiYYZGok?game=2';
const copy = () => structuredClone(fixture);
function html(props = fixture, split = false) {
  const record = `6:${JSON.stringify(['$', '$L29', null, props])}\n`;
  const chunks = split ? [record.slice(0, 33), record.slice(33, 77), record.slice(77)] : [record];
  return `<html>${(props.clientAssets || []).map(src => `<script src="${src}"></script>`).join('')}<script>self.__next_f.push([0])</script>${chunks.map(chunk => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('')}</html>`;
}
function response(body = html(), options: ResponseInit = {}) {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...options });
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('public Drafter URL boundary', () => {
  it('canonicalizes only the public host and drops UI/control parameters', () => {
    expect(parseDrafterUrl(`${link}&layout=lck&stream=true&team=red#anything`)).toEqual({
      sourceId: 'IiYYZGok', gameNumber: 2, sourceUrl: link,
    });
    expect(parseDrafterUrl('https://drafter.lol/draft/WHcbXs_s').gameNumber).toBe(1);
  });

  it.each([
    'http://drafter.lol/draft/IiYYZGok', 'https://127.0.0.1/draft/IiYYZGok',
    'https://drafter.lol.evil.test/draft/IiYYZGok', 'https://evil.test@drafter.lol/draft/IiYYZGok',
    'https://drafter.lol:8443/draft/IiYYZGok', 'https://drafter.lol/api/draft/IiYYZGok',
    'https://drafter.lol/draft/%49iYYZGok', 'https://drafter.lol/draft/IiYYZGok/more',
    'https://drafter.lol/draft/short', 'https://drafter.lol/draft/IiYYZGok?game=0',
    'https://drafter.lol/draft/IiYYZGok?game=6', 'https://drafter.lol/draft/IiYYZGok?game=2.5',
    'https://drafter.lol/draft/IiYYZGok?game=2&game=1', 'https://drafter.lol/draft/IiYYZGok?game=',
    'https://drafter.lol\\@localhost/draft/IiYYZGok', 'https://drafter.lol/draft/IiYYZGok\n',
  ])('refuses %s before any network request', async url => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(importDrafterDraft(url)).rejects.toMatchObject({ code: 'DRAFTER_INVALID_URL', status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('public hydration data', () => {
  it('imports exactly game 2 from the supplied real series without using its stale fearless aggregate', () => {
    const snapshot = parseDrafterHtml(html(), link);
    expect(snapshot).toMatchObject({
      source: 'drafter.lol', sourceId: 'IiYYZGok', sourceDraftId: 'ZWXUc3r9', gameNumber: 2,
      sourceUrl: link, status: 'completed', blueName: 'Arcane Horizon', redName: 'OPIF',
      bluePicks: ['Aatrox', 'Zeri', 'Braum', 'DrMundo', 'Locke'],
      redPicks: ['Yunara', 'Lulu', 'Anivia', 'Kennen', 'Maokai'],
      blueBans: ['Jhin', 'Khazix', 'JarvanIV', 'Gnar', 'Sylas'],
      redBans: ['MonkeyKing', 'Poppy', 'Thresh', 'Syndra', 'Diana'],
      fearless: true, ironman: false, firstPick: 'blue', patch: '16.20.1',
    });
    expect(snapshot.warnings).toContain('Les rôles finaux ne sont pas fournis. Les choix conservent leurs emplacements Drafter.');
    expect(Number.isNaN(Date.parse(snapshot.importedAt))).toBe(false);
    expect(snapshot.orderEvidence).toMatchObject({ version: 1, basis: 'reconstructed-public-slots', firstPick: 'blue' });
    expect(draftOrder(snapshot).events.filter(event => event.kind === 'pick').map(event => event.champion))
      .toEqual(['Aatrox', 'Yunara', 'Lulu', 'Zeri', 'Braum', 'Anivia', 'Kennen', 'DrMundo', 'Locke', 'Maokai']);
  });

  it('selects the series draft ID even when the object array is reordered', () => {
    const props = copy(); props.drafts.reverse();
    expect(parseDrafterHtml(html(props), 'https://drafter.lol/draft/IiYYZGok?game=1').sourceDraftId).toBe('02CT9UD3');
  });

  it('supports a completed standalone draft whose ID matches the URL', () => {
    const draft = copy().drafts[1]; delete draft.seriesId;
    expect(parseDrafterHtml(html({ drafts: [draft] }), 'https://drafter.lol/draft/ZWXUc3r9')).toMatchObject({ sourceId: 'ZWXUc3r9', gameNumber: 1 });
  });

  it.each([
    (props: any) => { props.series.seriesId = 'AnotherID'; },
    (props: any) => { props.drafts[1].seriesId = 'AnotherID'; },
    (props: any) => { props.drafts[1].gameNumber = 1; },
    (props: any) => { props.series.draftIDs[1] = props.series.draftIDs[0]; },
    (props: any) => { delete props.series.draftIDs; },
  ])('refuses mismatched identity or ambiguous numbering', change => {
    const props = copy(); change(props);
    expect(() => parseDrafterHtml(html(props), link)).toThrow(expect.objectContaining({ code: 'DRAFTER_LAYOUT_CHANGED' }));
  });

  it.each([3, 4])('does not clamp or substitute unavailable game %s', game => {
    expect(() => parseDrafterHtml(html(), `https://drafter.lol/draft/IiYYZGok?game=${game}`))
      .toThrow(expect.objectContaining({ code: game === 3 ? 'DRAFTER_INCOMPLETE' : 'DRAFTER_NOT_FOUND' }));
  });

  it.each(['', 'None', null, 'Zeri'])('refuses missing or duplicated picks (%s)', value => {
    const props = copy(); props.drafts[1].bluePick1 = value;
    expect(() => parseDrafterHtml(html(props), link)).toThrow(expect.objectContaining({ code: 'DRAFTER_INCOMPLETE' }));
  });

  it('normalizes champion aliases without inventing names and reports missing versus explicitly skipped bans', () => {
    const props = copy();
    props.drafts[1].redBan1 = 'Wukong'; delete props.drafts[1].blueBan1;
    props.drafts[1].blueBan2 = 'None'; props.drafts[1].bluePick1 = 'FutureChampion';
    const snapshot = parseDrafterHtml(html(props), link);
    expect(snapshot.redBans[0]).toBe('MonkeyKing');
    expect(snapshot.blueBans.slice(0, 2)).toEqual([null, null]);
    expect(snapshot.banStates?.blue.slice(0, 2)).toEqual(['unknown', 'skipped']);
    expect(snapshot.bluePicks[0]).toBe('FutureChampion');
    expect(snapshot.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('indisponibles : 1'), expect.stringContaining('« None » par Drafter : 2'),
    ]));
  });

  it('retains picks but declines chronology when client provenance or custom format is unverified', () => {
    for (const change of [
      (props: any) => { props.clientAssets[0] = '/_next/static/chunks/138-new-release.js'; },
      (props: any) => { props.drafts[1].draftType = 'custom'; },
      (props: any) => { props.drafts[1].firstSelection = true; props.drafts[1].firstPick = 'red'; },
    ]) {
      const props = copy(); change(props);
      const snapshot = parseDrafterHtml(html(props), link);
      expect(snapshot.bluePicks[0]).toBe('Aatrox');
      expect(draftOrder(snapshot)).toMatchObject({ status: 'unknown', events: [] });
    }
  });

  it('reconstructs the mirrored red-first sequence only with consistent explicit selection metadata', () => {
    const props = copy(); props.drafts[1].firstSelection = true;
    props.drafts[1].firstPick = 'red'; props.drafts[1].secondPick = 'blue';
    expect(draftOrder(parseDrafterHtml(html(props), link)).events.filter(event => event.kind === 'pick').map(event => event.label))
      .toEqual(['R1', 'B1', 'B2', 'R2', 'R3', 'B3', 'B4', 'R4', 'R5', 'B5']);
  });

  it('keeps source slots independent of final role assignments', () => {
    const props = copy(); props.drafts[1].roleAssignments = {
      blue: { top: 'DrMundo', jungle: 'Aatrox', mid: 'Locke', adc: 'Zeri', support: 'Braum' },
      red: { top: 'Kennen', jungle: 'Maokai', mid: 'Anivia', adc: 'Yunara', support: 'Lulu' },
    };
    const snapshot = parseDrafterHtml(html(props), link);
    expect(snapshot.bluePicks).toEqual(['Aatrox', 'Zeri', 'Braum', 'DrMundo', 'Locke']);
    expect(draftOrder(snapshot).events.find(event => event.kind === 'pick')).toMatchObject({ champion: 'Aatrox', label: 'B1' });
  });

  it.each([7, { champion: 'Ahri' }, '<script>Ahri</script>'])('rejects malformed ban data instead of silently losing coverage', value => {
    const props = copy(); props.drafts[1].blueBan1 = value;
    expect(() => parseDrafterHtml(html(props), link)).toThrow(expect.objectContaining({ code: 'DRAFTER_LAYOUT_CHANGED' }));
  });

  it('keeps whitespace-only bans unavailable with an explicit coverage warning', () => {
    const props = copy(); props.drafts[1].blueBan1 = '  ';
    expect(parseDrafterHtml(html(props), link)).toMatchObject({ blueBans: [null, 'Khazix', 'JarvanIV', 'Gnar', 'Sylas'], warnings: expect.arrayContaining([expect.stringContaining('indisponibles : 1')]) });
  });

  it('concatenates split Flight records and preserves Unicode team names', () => {
    const props = copy(); props.drafts[1].drafterBlue = 'Équipe Étoile ★';
    expect(parseDrafterHtml(html(props, true), link).blueName).toBe('Équipe Étoile ★');
  });

  it.each([
    '<html>no hydration data</html>',
    '<script>self.__next_f.push([1,"broken])</script>',
    '<script>self.__next_f.push([1,(globalThis.evaluated = true)])</script>',
    '<script>self.__next_f.push([1,"6:[broken\\n"])</script>',
  ])('fails closed on malformed or executable hydration input', markup => {
    expect(() => parseDrafterHtml(markup, link)).toThrow(expect.objectContaining({ code: 'DRAFTER_LAYOUT_CHANGED' }));
    expect((globalThis as any).evaluated).toBeUndefined();
  });
});

describe('bounded anonymous HTML request', () => {
  it('uses a fixed canonical origin without credentials, redirects, secrets or a browser', async () => {
    const fetcher = vi.fn().mockResolvedValue(response()); vi.stubGlobal('fetch', fetcher);
    await expect(importDrafterDraft(`${link}&team=red`)).resolves.toMatchObject({ sourceDraftId: 'ZWXUc3r9' });
    expect(fetcher).toHaveBeenCalledWith(link, {
      method: 'GET', redirect: 'manual', credentials: 'omit', signal: expect.any(AbortSignal), headers: { Accept: 'text/html' },
    });
  });

  it.each([301, 302, 403, 429, 500])('refuses HTTP %s without following redirects', async status => {
    const fetcher = vi.fn().mockResolvedValue(response('', { status, headers: { location: 'https://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(importDrafterDraft(link)).rejects.toMatchObject({ code: 'DRAFTER_UPSTREAM' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([404, 410])('maps HTTP %s to a public not-found error', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('', { status })));
    await expect(importDrafterDraft(link)).rejects.toMatchObject({ code: 'DRAFTER_NOT_FOUND' });
  });

  it('rejects non-HTML content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)));
    await expect(importDrafterDraft(link)).rejects.toMatchObject({ code: 'DRAFTER_UPSTREAM' });
  });

  it.each(['declared', 'streamed'])('caps %s body size', async mode => {
    const body = mode === 'streamed' ? 'x'.repeat(2 * 1024 * 1024 + 1) : 'small';
    const headers = { 'content-type': 'text/html', ...(mode === 'declared' ? { 'content-length': String(2 * 1024 * 1024 + 1) } : {}) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body, { headers })));
    await expect(importDrafterDraft(link)).rejects.toMatchObject({ code: 'DRAFTER_TOO_LARGE' });
  });

  it('decodes multibyte UTF-8 split across streamed chunks', async () => {
    const props = copy(); props.drafts[1].drafterBlue = 'Étoile';
    const bytes = new TextEncoder().encode(html(props, true));
    const unicodeAt = bytes.indexOf(0xc3);
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(bytes.slice(0, unicodeAt + 1)); controller.enqueue(bytes.slice(unicodeAt + 1)); controller.close();
    } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { headers: { 'content-type': 'text/html' } })));
    await expect(importDrafterDraft(link)).resolves.toMatchObject({ blueName: 'Étoile' });
  });

  it.each(['headers', 'body'])('bounds stalled %s to ten seconds', async stage => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const canceled = vi.fn();
    vi.stubGlobal('fetch', vi.fn((_url, options) => {
      signal = options.signal;
      if (stage === 'headers') return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      return Promise.resolve(new Response(new ReadableStream({ cancel: canceled }), { headers: { 'content-type': 'text/html' } }));
    }));
    const pending = expect(importDrafterDraft(link)).rejects.toMatchObject({ code: 'DRAFTER_TIMEOUT', status: 504 });
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(signal.aborted).toBe(true);
    if (stage === 'body') expect(canceled).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
