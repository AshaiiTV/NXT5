import { afterEach, expect, it, vi } from 'vitest';
import { sendSocialSignupEmail } from '../../netlify/functions/_lib/email';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('emails a confirmation only for a free address and account-association instructions to an existing owner',async()=>{
  vi.stubEnv('RESEND_API_KEY','test-key');vi.stubEnv('RESET_EMAIL_FROM','NXT5 <test@example.test>');
  const fetcher=vi.fn(async()=>new Response('{}'));
  vi.stubGlobal('fetch',fetcher);
  const signupUrl='https://nxt5.org/inscription?social=complete#email_token=secret';
  await sendSocialSignupEmail({to:'free@example.test',signupUrl});
  await sendSocialSignupEmail({to:'taken@example.test',signupUrl:null});
  const messages=fetcher.mock.calls.map((call:any)=>JSON.parse(call[1].body));
  expect(messages[0].text).toContain('15 minutes');
  expect(messages[0].html).toContain(`href="${signupUrl}"`);
  expect(messages[1].text).toContain('connecte-toi puis associe ce service dans Paramètres');
  expect(messages[1].html).not.toContain('email_token');
  expect(messages[1].html).not.toContain('<a');
});
