import { MEDICI_SENDER_EMAIL, MEDICI_SENDER_NAME } from '../constants';
import { buildShareEmailContent } from './clientEmail';

export async function sendShareEmailViaGmail({ to, type, client, url }) {
  const { subject, text } = buildShareEmailContent(type, client, url);
  const response = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      subject,
      text,
      fromName: MEDICI_SENDER_NAME,
      fromEmail: MEDICI_SENDER_EMAIL,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error || 'Gmail could not send the email.' };
  }
  return { ok: true, ...data };
}
