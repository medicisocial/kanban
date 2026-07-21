import { appendReviewerToShareUrl } from './contentReviewShare.mjs';

const SHARE_TYPES = new Set(['ideas', 'calendar', 'review', 'portal_invite']);

function getAgencyName() {
  return (process.env.AGENCY_NAME || process.env.VITE_AGENCY_NAME || 'Medici Social').trim();
}

function getFromAddress() {
  const from = (process.env.EMAIL_FROM || '').trim();
  if (from) return from;
  const name = getAgencyName();
  return `${name} <notifications@medicisocial.com>`;
}

function getReplyTo() {
  return (process.env.EMAIL_REPLY_TO || '').trim() || undefined;
}

function getProductName() {
  return (process.env.PRODUCT_NAME || 'Medici Social Portal').trim();
}

export function isEmailConfigured() {
  return Boolean((process.env.RESEND_API_KEY || '').trim());
}

export function normalizeShareType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  return SHARE_TYPES.has(normalized) ? normalized : null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buttonHtml(href, label) {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<a href="${safeHref}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#810100;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:2px;">${safeLabel}</a>`;
}

export function buildNotificationEmail({ shareType, client, agencyName, shareUrl, portalUrl, itemCount }) {
  const brand = client.trim();
  const portal = portalUrl.trim();
  const link = shareUrl.trim();
  const count = Number(itemCount) || 0;
  const countLabel = count === 1 ? '1 item' : `${count} items`;

  const templates = {
    ideas: {
      subject: `${brand} — video ideas to review`,
      preview: `${agencyName} sent ${countLabel} for your review.`,
      headline: 'Video ideas ready for your review',
      body: `Your team at <strong>${escapeHtml(agencyName)}</strong> submitted ${escapeHtml(countLabel)} for <strong>${escapeHtml(brand)}</strong>. Open the link below to approve concepts or decline with feedback — no sign-in required.`,
      cta: 'Review ideas',
      hint: 'Your responses are saved on this page and sent back to your account manager.',
    },
    calendar: {
      subject: `${brand} — content calendar update`,
      preview: `${agencyName} shared your upcoming content schedule.`,
      headline: 'Your content calendar is ready',
      body: `<strong>${escapeHtml(agencyName)}</strong> shared ${escapeHtml(countLabel)} on the production calendar for <strong>${escapeHtml(brand)}</strong>. Open the link below to view your schedule — no sign-in required.`,
      cta: 'View calendar',
      hint: 'This link shows only your brand’s calendar content.',
    },
    review: {
      subject: `${brand} — content awaiting approval`,
      preview: `${agencyName} sent content for your review.`,
      headline: 'Content ready for approval',
      body: `<strong>${escapeHtml(agencyName)}</strong> has ${escapeHtml(countLabel)} waiting for your approval for <strong>${escapeHtml(brand)}</strong>. Open the link below to review and respond — no sign-in required.`,
      cta: 'Review content',
      hint: 'Your approve or decline responses are saved on this page and sent back to your account manager.',
    },
    portal_invite: {
      subject: `Your ${brand} client portal`,
      preview: `${agencyName} invited you to the client portal.`,
      headline: `Welcome to your ${escapeHtml(brand)} workspace`,
      body: `<strong>${escapeHtml(agencyName)}</strong> set up a client portal for <strong>${escapeHtml(brand)}</strong>. Sign in to review ideas, approve content, and track production.`,
      cta: 'Sign in to portal',
      hint: 'Use the email and password your account manager shared with you.',
    },
  };

  const template = templates[shareType] || templates.ideas;
  const isPortalInvite = shareType === 'portal_invite';
  const ctaHref = isPortalInvite ? portal : link;
  const portalFooter =
    !isPortalInvite && portal
      ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#777;">Have a client portal login? <a href="${escapeHtml(portal)}" style="color:#c88;">Sign in here</a> for your full workspace.</p>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,Segoe UI,sans-serif;color:#f5f5f5;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;">${escapeHtml(agencyName)}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;color:#fff;">${template.headline}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#ccc;">${template.body}</p>
      ${buttonHtml(ctaHref, template.cta)}
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#999;">${template.hint}</p>
      ${portalFooter}
      <p style="margin:16px 0 8px;font-size:12px;line-height:1.6;color:#777;">Link:</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(ctaHref)}" style="color:#c88;">${escapeHtml(ctaHref)}</a></p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0;" />
      <p style="margin:0;font-size:11px;line-height:1.6;color:#666;">Sent via ${escapeHtml(getProductName())}. Reply to this email if you have questions.</p>
    </div>
  </body>
</html>`;

  const text = [
    template.headline,
    '',
    template.body.replace(/<[^>]+>/g, ''),
    '',
    `${template.cta}: ${ctaHref}`,
    template.hint.replace(/<[^>]+>/g, ''),
    !isPortalInvite && portal ? `Client portal: ${portal}` : '',
    '',
    `— ${agencyName}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: template.subject,
    preview: template.preview,
    html,
    text,
  };
}

export async function sendPlatformEmail({ to, subject, html, text, replyTo, attachments }) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Email is not configured. Add RESEND_API_KEY in Vercel environment variables.');
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (!recipients.length) {
    throw new Error('At least one email recipient is required.');
  }

  const resolvedReplyTo =
    replyTo === undefined ? getReplyTo() : String(replyTo || '').trim() || undefined;

  const resolvedAttachments = Array.isArray(attachments)
    ? attachments
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const filename = String(entry.filename || '').trim();
          const content = String(entry.content || '').trim();
          if (!filename || !content) return null;
          return {
            filename,
            content,
            ...(entry.contentType ? { content_type: entry.contentType } : {}),
          };
        })
        .filter(Boolean)
    : [];

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
      to: recipients,
      subject,
      html,
      text,
      ...(resolvedAttachments.length ? { attachments: resolvedAttachments } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.message || payload?.error || response.statusText;
    throw new Error(detail || 'Email provider rejected the send.');
  }

  return payload;
}

export async function sendClientNotificationEmails({
  shareType,
  client,
  recipients,
  shareUrl,
  portalUrl,
  itemCount,
}) {
  const agencyName = getAgencyName();

  const results = [];
  for (const recipient of recipients) {
    const recipientShareUrl =
      shareType === 'review'
        ? appendReviewerToShareUrl(shareUrl, recipient.email)
        : shareUrl;
    const email = buildNotificationEmail({
      shareType,
      client,
      agencyName,
      shareUrl: recipientShareUrl,
      portalUrl,
      itemCount,
    });
    const sent = await sendPlatformEmail({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    results.push({ email: recipient.email, id: sent?.id || null });
  }

  return {
    agencyName,
    subject: results.length ? buildNotificationEmail({
      shareType,
      client,
      agencyName,
      shareUrl,
      portalUrl,
      itemCount,
    }).subject : '',
    sent: results.length,
    results,
  };
}

export function buildClientPasswordResetEmail({ brand, resetUrl }) {
  const agencyName = getAgencyName();
  const productName = getProductName();
  const subject = `Reset your ${brand} portal password`;
  const headline = 'Reset your client portal password';
  const body = `We received a request to reset the password for your <strong>${escapeHtml(brand)}</strong> client portal account. Click below to choose a new password. This link expires in one hour.`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,Segoe UI,sans-serif;color:#f5f5f5;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#888;">${escapeHtml(agencyName)}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;color:#fff;">${headline}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#ccc;">${body}</p>
      ${buttonHtml(resetUrl, 'Reset password')}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#999;">If you did not request this, you can ignore this email.</p>
      <hr style="border:none;border-top:1px solid #222;margin:24px 0;" />
      <p style="margin:0;font-size:11px;line-height:1.6;color:#666;">Sent via ${escapeHtml(productName)}.</p>
    </div>
  </body>
</html>`;

  const text = [
    headline,
    '',
    `Reset the password for your ${brand} client portal account:`,
    resetUrl,
    '',
    'This link expires in one hour. If you did not request this, ignore this email.',
    '',
    `— ${agencyName}`,
  ].join('\n');

  return { subject, html, text };
}

export async function sendClientPasswordResetEmail({ to, brand, resetUrl }) {
  const email = buildClientPasswordResetEmail({ brand, resetUrl });
  await sendPlatformEmail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
