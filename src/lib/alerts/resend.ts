type AlertPayload = {
  subject: string;
  body: string;
};

export async function sendAlert({ subject, body }: AlertPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_TO_EMAIL;
  const from = process.env.ALERT_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    console.warn('[alert] Resend env not configured, skip alert');
    return;
  }

  try {
    const env = process.env.VERCEL_ENV ?? 'local';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[${env}] ${subject}`,
        text: body,
      }),
    });

    if (!res.ok) {
      console.error(`[alert] Resend failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('[alert] Resend error:', err);
  }
}
