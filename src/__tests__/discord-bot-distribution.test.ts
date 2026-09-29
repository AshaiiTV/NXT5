import { beforeEach, it, expect, vi } from 'vitest';
const state=vi.hoisted(()=>({schedule:vi.fn(),deliver:vi.fn(),prune:vi.fn()}));
vi.mock('../../netlify/functions/_lib/discord-access',()=>({assertDiscordArtifactEnvironment:()=>{},discordResponseError:()=>new Response(null,{status:503})}));
vi.mock('../../netlify/functions/_lib/discord-config',()=>({isDiscordEnabled:()=>true,verifyDiscordInternalRequest:()=>true}));
vi.mock('../../netlify/functions/_lib/discord-bot-common',()=>({assertDiscordBotSchemaReady:async()=>{}}));
vi.mock('../../netlify/functions/_lib/discord-bot-schedule',()=>({enqueueScheduledBotMessages:state.schedule,deliverBotOutbox:state.deliver,pruneDiscordBotArtifacts:state.prune}));
import handler from '../../netlify/functions/discord-bot-workflows-background';
beforeEach(()=>vi.resetAllMocks());
it('delivers queued jobs even when the collective scheduling SQL rejects a timezone',async()=>{
  state.prune.mockResolvedValue({});
  state.schedule.mockRejectedValue(new Error('time zone not recognized'));
  state.deliver.mockResolvedValue({sent:2});
  const response=await handler(new Request('https://nxt5.org/workflow',{method:'POST',body:'{}'}));
  expect(state.deliver).toHaveBeenCalledExactlyOnceWith(10);
  expect(response.status).toBe(503);
});

it('also delivers if artifact pruning fails',async()=>{
  state.prune.mockRejectedValue(new Error('pruning unavailable'));
  state.deliver.mockResolvedValue({sent:1});
  expect((await handler(new Request('https://nxt5.org/workflow',{method:'POST',body:'{}'}))).status).toBe(503);
  expect(state.deliver).toHaveBeenCalledExactlyOnceWith(10);
});
