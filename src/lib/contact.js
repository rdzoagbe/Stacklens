const WEB3FORMS_KEY = '88adb1a1-a43c-4395-b37f-b3dd7ac14411';
const WEB3FORMS_URL = 'https://api.web3forms.com/submit';
const RECIPIENT = 'hello@stacklens.fr';

export async function submitContactForm({ name, email, subject, message }) {
  const res = await fetch(WEB3FORMS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      from_name: name,
      email,
      subject: `[Stacklens ${subject}] from ${name}`,
      message: `From: ${name} (${email})\n\n${message}`,
      to: RECIPIENT,
    }),
  });
  if (!res.ok) throw new Error('Web3Forms API error');
}

export function mailtoFallback({ name, email, subject, message }) {
  window.location.href = `mailto:${RECIPIENT}?subject=${encodeURIComponent(`[Stacklens ${subject}] ${name}`)}&body=${encodeURIComponent(message + '\n\nFrom: ' + name + ' (' + email + ')')}`;
}
