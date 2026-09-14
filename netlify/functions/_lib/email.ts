import { emailAction, emailNote, emailShell } from './email-template.js';

function env(name) {
  return (globalThis as any).Netlify?.env?.get?.(name) || process.env[name] || '';
}

export function isPasswordEmailConfigured() {
  return Boolean(env('RESEND_API_KEY') && env('RESET_EMAIL_FROM'));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

async function sendResendEmail({ to, subject, text, html }) {
  if (!isPasswordEmailConfigured()) {
    throw Object.assign(new Error('Envoi e-mail non configuré. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM dans Netlify.'), {
      status: 500,
      code: 'EMAIL_NOT_CONFIGURED',
      publicMessage: 'Envoi e-mail non configuré côté serveur.'
    });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env('RESET_EMAIL_FROM'),
      to,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Resend email delivery failed', { status: response.status, detail });
    throw Object.assign(new Error(`Envoi e-mail impossible.${detail ? ` ${detail}` : ''}`), {
      status: 502,
      code: 'EMAIL_DELIVERY_FAILED',
      publicMessage: `Resend refuse l'envoi de l'e-mail (HTTP ${response.status}). Vérifie RESEND_API_KEY, RESET_EMAIL_FROM et le domaine d'envoi.`
    });
  }
}

export async function sendEmailVerificationEmail({ to, token }) {
  const siteUrl = String(env('PUBLIC_SITE_URL') || 'https://nxt5.org').replace(/\/+$/, '');
  const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;

  await sendResendEmail({
    to,
    subject: 'Confirme ton adresse e-mail NXT5',
    text: `Bienvenue sur NXT5 !\n\nConfirme ton adresse e-mail pour activer les notifications de ton espace d'équipe :\n${verifyUrl}\n\nCe lien est valable 24h.\n\nSi tu n'as pas créé de compte sur NXT5, ignore cet e-mail.`,
    html: emailShell({
      title: 'Confirme ton adresse e-mail',
      eyebrow: 'Bienvenue dans ton espace',
      preview: 'Confirme ton adresse e-mail NXT5. Ce lien est valable 24 heures.',
      siteUrl,
      html: '<p style="margin:0 0 16px">Bienvenue sur NXT5. Confirme ton adresse e-mail pour recevoir les notifications de ton espace et de ton équipe.</p>'
        + emailAction({ href: verifyUrl, label: 'Confirmer mon adresse e-mail' })
        + emailNote({ title: 'Un lien personnel, valable 24 heures', html: 'Si tu n’es pas à l’origine de cette inscription, tu peux ignorer cet e-mail. Ne partage pas ce lien.' }),
    })
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Réinitialisation de ton mot de passe NXT5';
  const safeName = name || 'joueur';
  const siteUrl = String(env('PUBLIC_SITE_URL') || 'https://nxt5.org').replace(/\/+$/, '');
  const supportUrl = `${siteUrl}/contact`;
  const htmlName = escapeHtml(safeName);

  await sendResendEmail({
    to,
    subject,
    text: `Salut ${safeName},\n\nTu as demandé à réinitialiser ton mot de passe NXT5.\n\nOuvre ce lien dans les 30 prochaines minutes :\n${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, contacte le support NXT5 dès que possible :\n${supportUrl}`,
    html: emailShell({
      title: 'Un nouveau mot de passe',
      eyebrow: 'Sécurité du compte',
      preview: 'Réinitialise ton mot de passe NXT5. Ce lien est valable 30 minutes.',
      siteUrl,
      html: '<p style="margin:0 0 16px">Bonjour ' + htmlName + ',</p><p style="margin:0 0 16px">Tu as demandé à réinitialiser ton mot de passe NXT5. Choisis-en un nouveau pour retrouver ton espace.</p>'
        + emailAction({ href: resetUrl, label: 'Choisir un nouveau mot de passe' })
        + emailNote({ title: 'Ce lien expire dans 30 minutes', html: 'Si tu n’as pas demandé ce changement, ignore cet e-mail : ton mot de passe reste inchangé. En cas de doute, contacte le support depuis le lien ci-dessous.' }),
    })
  });
}

export async function sendInactivityReminderEmail({ to, name }) {
  const siteUrl = String(env('PUBLIC_SITE_URL') || 'https://nxt5.org').replace(/\/+$/, '');
  const workspaceUrl = `${siteUrl}/equipes`;
  const settingsUrl = `${siteUrl}/parametres`;
  const safeName = String(name || 'joueur').trim().slice(0, 80) || 'joueur';
  const htmlName = escapeHtml(safeName);
  const htmlSettingsUrl = escapeHtml(settingsUrl);

  await sendResendEmail({
    to,
    subject: 'Ton espace NXT5 est toujours prêt',
    text: `Salut ${safeName},\n\nCela fait environ trois mois que ton compte NXT5 n'a pas été actif. Ton espace et tes données sont toujours disponibles.\n\nReprendre sur NXT5 : ${workspaceUrl}\n\nTu peux désactiver ce rappel dans tes paramètres : ${settingsUrl}`,
    html: emailShell({
      title: 'Ton équipe, tes prochains objectifs',
      eyebrow: 'Ton espace t’attend',
      preview: 'Retrouve ton profil, tes matchs et ton équipe sur NXT5.',
      siteUrl,
      html: '<p style="margin:0 0 16px">Bonjour ' + htmlName + ',</p><p style="margin:0 0 16px">Cela fait environ trois mois que ton compte n’a pas été actif. Ton espace et tes données sont toujours disponibles.</p>'
        + emailAction({ href: workspaceUrl, label: 'Retrouver mon espace' })
        + emailNote({ title: 'Tu gardes la main', html: 'Ce rappel est envoyé une seule fois par période d’inactivité. Tu peux le désactiver dans <a href="' + htmlSettingsUrl + '" style="color:#67E8F9;text-decoration:underline">tes préférences de notification</a>.' }),
    })
  });
}
