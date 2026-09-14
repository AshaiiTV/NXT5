import { emailShell } from './_lib/email-template.js';

function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name] || '';
}



function notificationShell({ subject, html, siteUrl }) {
  return emailShell({ title: subject, html, eyebrow: 'La vie de ton équipe', siteUrl: siteUrl || env('PUBLIC_SITE_URL') || 'https://nxt5.org' });
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendNotification({ to, subject, html, siteUrl = '' }) {
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
        html: notificationShell({ subject, html, siteUrl })
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
