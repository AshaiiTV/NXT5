export function isPasswordEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESET_EMAIL_FROM);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function sendResendEmail({ to, subject, text, html }) {
  if (!isPasswordEmailConfigured()) {
    throw Object.assign(new Error('Envoi e-mail non configuré. Ajoute RESEND_API_KEY et RESET_EMAIL_FROM dans Netlify.'), { status: 500, code: 'EMAIL_NOT_CONFIGURED' });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESET_EMAIL_FROM,
      to,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(new Error(`Envoi e-mail impossible.${detail ? ` ${detail}` : ''}`), { status: 502 });
  }
}

export async function sendEmailVerificationEmail({ to, token }) {
  const siteUrl = String(process.env.PUBLIC_SITE_URL || 'https://nxt5.org').replace(/\/+$/, '');
  const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const htmlVerifyUrl = escapeHtml(verifyUrl);

  await sendResendEmail({
    to,
    subject: '[NXT5] Confirme ton adresse email',
    text: `Bienvenue sur NXT5 !\n\nClique sur ce lien pour vérifier ton adresse email :\n${verifyUrl}\n\nCe lien est valable 24h.\n\nSi tu n'as pas créé de compte sur NXT5, ignore cet email.`,
    html: `
      <p>Bienvenue sur NXT5 !</p>
      <p>Clique sur le lien ci-dessous pour vérifier ton adresse email.</p>
      <p>Ce lien est valable 24h.</p>
      <p><a href="${htmlVerifyUrl}">Vérifier mon email</a></p>
      <hr>
      <p style="font-size:12px;color:#888">Si tu n'as pas créé de compte sur NXT5, ignore cet email.</p>
    `
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const subject = 'Réinitialisation de ton mot de passe NXT5';
  const safeName = name || 'joueur';
  const siteUrl = String(process.env.PUBLIC_SITE_URL || 'https://nxt5.org').replace(/\/+$/, '');
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
