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
  const htmlVerifyUrl = escapeHtml(verifyUrl);
  const htmlSiteUrl = escapeHtml(siteUrl);

  await sendResendEmail({
    to,
    subject: 'Confirme ton adresse e-mail NXT5',
    text: `Bienvenue sur NXT5 !\n\nConfirme ton adresse e-mail pour activer les notifications de ton espace d'équipe :\n${verifyUrl}\n\nCe lien est valable 24h.\n\nSi tu n'as pas créé de compte sur NXT5, ignore cet e-mail.`,
    html: `
      <div style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#e5eefb">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f4f7fb">
          <tr>
            <td align="center" style="padding:34px 14px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;border-collapse:collapse;overflow:hidden;border-radius:30px;background:#050814;box-shadow:0 28px 80px rgba(5,8,20,.24)">
                <tr>
                  <td style="padding:0;background:linear-gradient(135deg,#07111f 0%,#050814 48%,#170b2b 100%)">
                    <div style="height:6px;background:linear-gradient(90deg,#00d8ff 0%,#8b5cf6 55%,#ec4899 100%)"></div>
                    <div style="padding:36px 34px 32px">
                      <div style="display:inline-block;margin:0 0 22px;padding:7px 12px;border:1px solid rgba(103,232,249,.32);border-radius:999px;background:rgba(8,145,178,.16);color:#a5f3fc;font-size:12px;font-weight:900;letter-spacing:.09em;text-transform:uppercase">Vérification e-mail</div>
                      <h1 style="margin:0;color:#ffffff;font-size:32px;line-height:1.08;font-weight:900">Active ton accès NXT5</h1>
                      <p style="margin:18px 0 0;color:#dbeafe;font-size:16px;line-height:1.7">Bienvenue sur NXT5. Confirme cette adresse e-mail pour sécuriser ton compte et recevoir les notifications importantes de ton équipe.</p>

                      <div style="margin:30px 0 28px">
                        <a href="${htmlVerifyUrl}" style="display:inline-block;border-radius:18px;background:linear-gradient(135deg,#22d3ee 0%,#3b82f6 48%,#d946ef 100%);color:#ffffff;text-decoration:none;padding:16px 24px;font-size:15px;font-weight:900;box-shadow:0 18px 42px rgba(34,211,238,.24)">Confirmer mon adresse</a>
                      </div>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                        <tr>
                          <td style="border:1px solid rgba(250,204,21,.24);border-radius:18px;background:rgba(113,63,18,.22);padding:17px 18px">
                            <p style="margin:0;color:#fef3c7;font-size:14px;line-height:1.6;font-weight:900">Lien valable pendant 24h</p>
                            <p style="margin:7px 0 0;color:#fde68a;font-size:13px;line-height:1.6">Une fois confirmé, les notifications de match, rapport et équipe pourront être envoyées normalement.</p>
                          </td>
                        </tr>
                      </table>

                      <div style="margin-top:18px;border:1px solid rgba(148,163,184,.18);border-radius:18px;background:rgba(15,23,42,.58);padding:18px 18px 16px">
                        <p style="margin:0;color:#f8fafc;font-size:14px;line-height:1.6;font-weight:800">Le bouton ne s'ouvre pas ?</p>
                        <p style="margin:8px 0 0;color:#a8b3c7;font-size:13px;line-height:1.6">Copie ce lien dans ton navigateur :</p>
                        <p style="margin:8px 0 0;color:#67e8f9;font-size:12px;line-height:1.55;word-break:break-all">${htmlVerifyUrl}</p>
                      </div>

                      <div style="margin-top:18px;border:1px solid rgba(248,113,113,.24);border-radius:18px;background:rgba(127,29,29,.18);padding:16px 18px">
                        <p style="margin:0;color:#ffe4e6;font-size:14px;line-height:1.6;font-weight:800">Tu n'es pas à l'origine de cette demande ?</p>
                        <p style="margin:7px 0 0;color:#fecdd3;font-size:13px;line-height:1.6">Ignore cet e-mail. Aucun accès ne sera accordé sans validation du lien.</p>
                      </div>

                      <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.6">Cet e-mail a été envoyé automatiquement par NXT5 depuis ${htmlSiteUrl}. Ne transfère pas ce lien de vérification.</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Réinitialisation de ton mot de passe NXT5';
  const safeName = name || 'joueur';
  const siteUrl = String(env('PUBLIC_SITE_URL') || 'https://nxt5.org').replace(/\/+$/, '');
  const supportUrl = `${siteUrl}/contact`;
  const htmlName = escapeHtml(safeName);
  const htmlResetUrl = escapeHtml(resetUrl);
  const htmlSupportUrl = escapeHtml(supportUrl);

  await sendResendEmail({
    to,
    subject,
    text: `Salut ${safeName},\n\nTu as demandé à réinitialiser ton mot de passe NXT5.\n\nOuvre ce lien dans les 30 prochaines minutes :\n${resetUrl}\n\nSi tu n'es pas à l'origine de cette demande, contacte le support NXT5 dès que possible :\n${supportUrl}`,
    html: `
        <div style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#e5eefb">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f4f7fb">
            <tr>
              <td align="center" style="padding:32px 14px">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;overflow:hidden;border-radius:28px;background:#070b16;box-shadow:0 24px 70px rgba(7,11,22,.22)">
                  <tr>
                    <td style="padding:0;background:linear-gradient(135deg,#07111f 0%,#050814 55%,#11152a 100%)">
                      <div style="height:6px;background:linear-gradient(90deg,#00d8ff,#7c3aed,#22c55e)"></div>
                      <div style="padding:34px 34px 30px">
                        <div style="display:inline-block;margin:0 0 22px;padding:7px 11px;border:1px solid rgba(103,232,249,.30);border-radius:999px;background:rgba(8,145,178,.14);color:#9beafe;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Sécurité du compte</div>
                        <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.12;font-weight:900">Réinitialisation de ton mot de passe</h1>
                        <p style="margin:18px 0 0;color:#cbd5e1;font-size:16px;line-height:1.65">Salut ${htmlName},</p>
                        <p style="margin:10px 0 0;color:#e2e8f0;font-size:16px;line-height:1.65">On a reçu une demande pour modifier le mot de passe de ton compte NXT5. Utilise le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
                        <div style="margin:28px 0 26px">
                          <a href="${htmlResetUrl}" style="display:inline-block;border-radius:16px;background:#00d8ff;color:#020511;text-decoration:none;padding:15px 22px;font-size:15px;font-weight:900;box-shadow:0 16px 38px rgba(0,216,255,.24)">Changer mon mot de passe</a>
                        </div>
                        <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;background:rgba(15,23,42,.56);padding:18px 18px 16px">
                          <p style="margin:0;color:#f8fafc;font-size:14px;line-height:1.6;font-weight:800">Ce lien expire dans 30 minutes.</p>
                          <p style="margin:8px 0 0;color:#a8b3c7;font-size:13px;line-height:1.6">Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :</p>
                          <p style="margin:8px 0 0;color:#67e8f9;font-size:12px;line-height:1.55;word-break:break-all">${htmlResetUrl}</p>
                        </div>
                        <div style="margin-top:18px;border:1px solid rgba(251,113,133,.24);border-radius:18px;background:rgba(127,29,29,.20);padding:16px 18px">
                          <p style="margin:0;color:#ffe4e6;font-size:14px;line-height:1.6;font-weight:800">Tu n'es pas à l'origine de cette demande ?</p>
                          <p style="margin:7px 0 0;color:#fecdd3;font-size:13px;line-height:1.6">Contacte le support NXT5 dès que possible afin que l'on puisse t'aider à sécuriser ton compte.</p>
                          <p style="margin:10px 0 0"><a href="${htmlSupportUrl}" style="color:#67e8f9;font-size:13px;font-weight:800;text-decoration:none">Contacter le support</a></p>
                        </div>
                        <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.6">Cet e-mail a été envoyé automatiquement par NXT5. Ne partage jamais ton lien de réinitialisation.</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `
  });
}
