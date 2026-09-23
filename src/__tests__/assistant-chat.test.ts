import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), rate: vi.fn(), completion: vi.fn() }));
vi.mock('../../netlify/functions/_lib/auth', () => ({ assertSessionSecret: vi.fn(), requireAuth: mocks.auth }));
vi.mock('../../netlify/functions/_lib/db', () => ({ sql: mocks.sql }));
vi.mock('../../netlify/functions/_lib/rate-limit', () => ({ assertRateLimit: mocks.rate }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.completion } }; } }));

import handler from '../../netlify/functions/assistant-chat';

const request = (body: object) => new Request('https://nxt5.test/.netlify/functions/assistant-chat', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NXT5_ASSISTANT_DISABLE_AI', '0');
  mocks.auth.mockResolvedValue({ id: 'test-user' });
  mocks.rate.mockResolvedValue(undefined);
  mocks.sql.mockResolvedValue([{ id: 'private-team' }]);
  mocks.completion.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    answer: 'Ouvre Paramètres → Connexions associées pour associer Google.',
    actions: [{ label: 'Paramètres', path: '/parametres' }], suggestions: [],
  }) } }] });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('assistant documentation delivery', () => {
  it('sends the updated FAQ to the model without selected team or entity data', async () => {
    const response = await handler(request({
      message: 'Comment associer Google à mon compte ?',
      route: '/parametres?team=private-team', selectedTeamId: 'private-team',
      selectedEntity: { type: 'player', id: 'private-player', name: 'Private Player', stats: { kills: 42 } },
    }), {} as any);
    expect(response.status).toBe(200);
    expect((await response.json()).fallback).toBe(false);
    const payload = mocks.completion.mock.calls[0][0];
    const userMessage = payload.messages.at(-1).content;
    const context = JSON.parse(userMessage.split('CONTEXTE_DOCUMENTAIRE\n')[1].split('\n\nQUESTION_UTILISATEUR')[0]);
    expect(context.currentRoute).toBe('/parametres');
    expect(context.selectedEntityType).toBe('player');
    const social = context.documentation.find((entry: any) => entry.id === 'social-sign-in');
    expect(social.faq.find((faq: any) => faq.question.includes('associer Google')).answer).toContain('elle n’est pas automatique');
    expect(JSON.stringify(payload)).not.toMatch(/private-team|private-player|Private Player|"kills"/);
    expect(mocks.sql).toHaveBeenCalledOnce();
  });

  it.each(['disabled', 'unavailable'])('serves the same current help when AI is %s', async (mode) => {
    if (mode === 'disabled') vi.stubEnv('NXT5_ASSISTANT_DISABLE_AI', '1');
    else mocks.completion.mockRejectedValue(new Error('Gateway unavailable'));
    const response = await handler(request({ message: 'Comment publier une game sur Discord ?', route: '/games' }), {} as any);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.fallback).toBe(true);
    expect(body.answer).toContain('Préparer l’aperçu');
    expect(body.actions[0].path).toBe('/bot-discord');
    if (mode === 'disabled') expect(mocks.completion).not.toHaveBeenCalled();
  });

  it('still checks team access before sending documentation or answering locally', async () => {
    vi.stubEnv('NXT5_ASSISTANT_DISABLE_AI', '1');
    mocks.sql.mockResolvedValue([]);
    const response = await handler(request({ message: 'Comment utiliser Discord ?', selectedTeamId: 'another-team' }), {} as any);
    expect(response.status).toBe(403);
    expect(mocks.completion).not.toHaveBeenCalled();
  });
});
