// Shared presentation only: delivery, tokens and notification preferences stay
// with their existing callers. Inline styles also work without embedded CSS.
const escape = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function emailAction({ href, label }) {
  const url = escape(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:26px 0 20px"><tr><td align="center" bgcolor="#164E63" style="border:1px solid #67E8F9;border-radius:8px;background-color:#164E63;background-image:linear-gradient(110deg,#164E63,#1E3A8A,#701A75)"><a href="${url}" style="display:block;padding:16px 20px;border-radius:8px;color:#FFFFFF;font-size:16px;font-weight:800;line-height:24px;text-align:center;text-decoration:none;mso-padding-alt:0"><!--[if mso]><i style="mso-font-width:100%;mso-text-raise:24pt">&nbsp;</i><![endif]-->${escape(label)}<!--[if mso]><i style="mso-font-width:100%">&nbsp;</i><![endif]--></a></td></tr></table><p style="margin:0 0 24px;color:#B8C6DC;font-size:12px;line-height:20px">Si le bouton ne fonctionne pas, ouvre ce lien :<br><a href="${url}" style="color:#67E8F9;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all">${url}</a></p>`;
}

export function emailNote({ title, html }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:24px 0 0"><tr><td bgcolor="#0A1427" style="padding:16px;border:1px solid #24354B;border-left:3px solid #67E8F9;border-radius:8px;color:#DBE8F8;font-size:14px;line-height:23px"><strong style="display:block;margin-bottom:6px;color:#F8FAFC">${escape(title)}</strong>${html}</td></tr></table>`;
}

export function emailShell({ title, html, preview = '', eyebrow = 'Notification', siteUrl = 'https://nxt5.org' }) {
  const base = String(siteUrl || 'https://nxt5.org').replace(/\/+$/, '');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escape(title)}</title>
<style>body{margin:0!important;padding:0!important}table{border-collapse:separate}a{color:#67E8F9}.nxt5-email-content p{margin:0 0 16px}.nxt5-email-content strong{color:#F8FAFC}@media only screen and (max-width:600px){.nxt5-email-outer{padding:16px 10px!important}.nxt5-email-inner{padding:26px 20px!important}.nxt5-email-title{font-size:26px!important;line-height:32px!important}}</style></head>
<body bgcolor="#020611" style="margin:0;padding:0;background-color:#020611;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#EDF5FF;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escape(preview || title)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#020611"><tr><td class="nxt5-email-outer" align="center" style="padding:40px 20px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#070E1D" style="max-width:600px;table-layout:fixed;border:1px solid #24354B;border-radius:20px;background-color:#070E1D">
<tr><td height="4" bgcolor="#22D3EE" style="height:4px;font-size:0;line-height:0;border-radius:20px 20px 0 0;background-image:linear-gradient(90deg,#22D3EE,#3B82F6,#D946EF)">&nbsp;</td></tr>
<tr><td class="nxt5-email-inner" style="padding:36px 36px 32px;overflow-wrap:anywhere;word-wrap:break-word">
<a href="${escape(base)}" style="display:inline-block;text-decoration:none"><img src="${escape(base)}/assets/nxt5-wordmark.png?v=3" alt="NXT5" width="144" height="45" style="display:block;width:144px;max-width:100%;height:auto;border:0;color:#F8FAFC;font-size:24px;font-weight:800"></a>
<p style="margin:30px 0 10px;color:#67E8F9;font-size:11px;font-weight:800;line-height:18px;letter-spacing:2px;text-transform:uppercase">${escape(eyebrow)}</p>
<h1 class="nxt5-email-title" style="margin:0 0 24px;color:#F8FAFC;font-size:30px;font-weight:800;line-height:38px;letter-spacing:-.7px;overflow-wrap:anywhere">${escape(title)}</h1>
<div class="nxt5-email-content" style="color:#EDF5FF;font-size:15px;line-height:26px;overflow-wrap:anywhere">${html}</div>
</td></tr><tr><td class="nxt5-email-inner" style="padding:22px 36px;border-top:1px solid #24354B;color:#B8C6DC;font-size:12px;line-height:20px">Ton espace de progression en équipe.<br><a href="${escape(base)}/contact" style="color:#67E8F9;text-decoration:underline">Besoin d’aide ?</a><span aria-hidden="true" style="color:#70839C"> &nbsp; / &nbsp; </span><a href="${escape(base)}/confidentialite" style="color:#B8C6DC;text-decoration:underline">Confidentialité</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
