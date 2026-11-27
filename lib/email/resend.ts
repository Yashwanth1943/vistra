export interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  restrictedRecipient?: boolean;
  error?: string;
}

export type EmailTransport = (payload: SendEmailPayload) => Promise<SendEmailResult>;

let customTransportForTests: EmailTransport | null = null;

export function setEmailTransportForTests(transport: EmailTransport | null): void {
  customTransportForTests = transport;
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  if (customTransportForTests) {
    return customTransportForTests(payload);
  }

  const apiKey = process.env.EMAIL_PROVIDER_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      error: 'Email delivery is not configured on the server.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const isTestSenderRestriction =
        response.status === 403 &&
        /verify a domain|verify your domain|domain is not verified|your own email address|testing emails/i.test(errorText);
      if (isTestSenderRestriction) {
        return {
          ok: false,
          restrictedRecipient: true,
          error: 'Resend test-sender restriction: external recipients require a verified domain.',
        };
      }
      return {
        ok: false,
        error: `Email provider returned ${response.status}${errorText ? `: ${errorText.slice(0, 200)}` : ''}`,
      };
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to reach email provider.',
    };
  }
}
