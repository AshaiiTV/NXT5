import { maskEmail, sendAccountSecurityEmail } from './email';
import { runInBackground } from './response-timing';

export type AccountNoticeKind = 'password-changed' | 'password-reset' | 'email-change-requested' | 'email-changed';

function noticeContent(kind: AccountNoticeKind, newEmail = '') {
  const masked = newEmail ? maskEmail(newEmail) : '';
  switch (kind) {
    case 'password-changed':
      return { subject: 'Ton mot de passe NXT5 a été modifié', title: 'Mot de passe modifié',
        paragraphs: ['Le mot de passe de ton compte NXT5 vient d’être modifié depuis tes paramètres. Tes autres sessions ont été déconnectées.'] };
    case 'password-reset':
      return { subject: 'Ton mot de passe NXT5 a été réinitialisé', title: 'Mot de passe réinitialisé',
        paragraphs: ['Le mot de passe de ton compte NXT5 vient d’être réinitialisé avec un lien de récupération. Toutes tes sessions ont été déconnectées.'] };
    case 'email-change-requested':
      return { subject: 'Changement d’adresse e-mail demandé sur NXT5', title: 'Changement d’adresse demandé',
        paragraphs: [`Une modification de l’adresse e-mail de ton compte NXT5 vers ${masked} a été demandée.`,
          'Ton adresse actuelle reste active tant que la nouvelle n’est pas confirmée. Tu peux annuler la demande dans Paramètres.'] };
    case 'email-changed':
      return { subject: 'L’adresse e-mail de ton compte NXT5 a changé', title: 'Adresse e-mail modifiée',
        paragraphs: [`L’adresse e-mail de ton compte NXT5 est désormais ${masked}. Cette adresse-ci ne recevra plus les e-mails du compte.`,
          'Les autres sessions ont été déconnectées et les liens de récupération envoyés ici ne sont plus valables.'] };
  }
}

/**
 * Security notice to an account address. Best effort, after the response when
 * the platform allows it: delivery problems never fail or delay the action,
 * and logs carry no address or message content.
 */
export function notifyAccountSecurity(context: unknown, to: string | null | undefined, kind: AccountNoticeKind, newEmail = ''): Promise<void> {
  if (!to) return Promise.resolve();
  const delivery = (async () => {
    try {
      await sendAccountSecurityEmail({ to, ...noticeContent(kind, newEmail) });
    } catch {
      console.error('[account-notice] Security notice unavailable.', { kind, code: 'ACCOUNT_NOTICE_FAILED' });
    }
  })();
  return runInBackground(context, delivery);
}
