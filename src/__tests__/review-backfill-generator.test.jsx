import { describe, expect, it } from 'vitest';
import { loadReviewBackfillGenerator } from '../../tools/review-backfill-generator.mjs';
import { buildRetroactiveCoachContent, stripGeneratedReportContent } from '../pages/workspace/GameWorkspace.jsx';

describe('production review backfill generator', () => {
  it('runs without a browser and produces the exact application analysis and notes', async () => {
    const generator = await loadReviewBackfillGenerator();
    const matches = ['one', 'two'].map((id) => ({
      id, game_id: `EUW1_${id}`, result: 'Victoire', side: 'BLUE', duration: '25:00', raw: {},
      participants: [
        { role: 'ADC', team_key: 'ALLY', summoner_name: 'ADC', champion: 'Jinx', kills: 3, deaths: 2, assists: 4, gold: 10000, damage: 20000, vision: 15, raw: { participantId: 1, teamId: 100 } },
        { role: 'ADC', team_key: 'ENEMY', summoner_name: 'Opponent', champion: 'Ashe', kills: 2, deaths: 3, assists: 1, gold: 8000, damage: 17000, vision: 12, raw: { participantId: 6, teamId: 200 } },
      ],
    }));
    for (const match_ids of [['one'], ['two', 'one']]) {
      const report = { title: 'Review historique', match_ids, content: '  Notes coach\nCall à conserver.  \n' };
      const generated = generator.generateContent(report, matches);
      expect(generated).toBe(buildRetroactiveCoachContent(report, matches));
      expect(generator.stripGeneratedContent(generated)).toBe(report.content);
      expect(stripGeneratedReportContent(generated)).toBe(report.content);
      expect(generator.getMatchIds(report)).toEqual(match_ids);
      expect(generated).toContain('LECTURE PAR JOUEUR');
    }
  }, 30_000);
});
