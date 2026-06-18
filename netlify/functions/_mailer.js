function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name] || '';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function notificationShell({ subject, html }) {
  const safeSubject = escapeHtml(subject);
  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Inter,Arial,sans-serif;color:#e5eefb">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f4f7fb">
        <tr>
          <td align="center" style="padding:32px 14px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;overflow:hidden;border-radius:28px;background:#070b16;box-shadow:0 24px 70px rgba(7,11,22,.22)">
              <tr>
                <td style="padding:0;background:linear-gradient(135deg,#07111f 0%,#050814 55%,#11152a 100%)">
                  <div style="height:6px;background:linear-gradient(90deg,#00d8ff,#7c3aed,#22c55e)"></div>
                  <div style="padding:34px 34px 30px">
                    <div style="display:inline-block;margin:0 0 22px;padding:7px 11px;border:1px solid rgba(103,232,249,.30);border-radius:999px;background:rgba(8,145,178,.14);color:#9beafe;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Notification NXT5</div>
                    <h1 style="margin:0;color:#ffffff;font-size:30px;line-height:1.12;font-weight:900">${safeSubject}</h1>
                    <div style="margin-top:18px;color:#e2e8f0;font-size:16px;line-height:1.65">${html}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendNotification({ to, subject, html }) {
  try {
    const apiKey = env('RESEND_API_KEY');
    const from = env('RESET_EMAIL_FROM');
    if (!apiKey || !from) {
      console.error('[mailer] Notification email not configured.');
      return;
    }
    if (!to || !subject || !html) return;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: textFromHtml(html),
        html: notificationShell({ subject, html })
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[mailer] Notification email failed.${detail ? ` ${detail}` : ''}`);
    }
  } catch (err) {
    console.error('[mailer] Notification email failed.', err);
  }
}
