export interface WelcomeEmailTemplateInput {
  name: string;
}

export interface MagicLinkEmailTemplateInput {
  name: string;
  loginUrl: string;
  expiresInMinutes: number;
}

export interface EmailMessage {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildWelcomeEmail({ name }: WelcomeEmailTemplateInput): EmailMessage {
  const safeName = escapeHtml(name);
  const subject = 'Welcome to Vistra — Your account is ready!';

  const text = [
    `Hi ${name},`,
    '',
    'Your Vistra account has been successfully created.',
    '',
    'Welcome to Vistra! You can now explore interactive learning experiences and discover web technologies visually.',
    '',
    'See beyond the code.',
    '',
    '— Team Vistra',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F0F1A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px 16px;border-bottom:1px solid #F1F5F9;">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.4px;color:#0F0F1A;">
            <span style="color:#6D28D9;">V</span>istra
          </div>
          <div style="font-size:12px;color:#64748B;margin-top:2px;">See beyond the code.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${safeName},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your Vistra account has been successfully created.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
            Welcome to Vistra! You can now explore interactive learning experiences and discover web technologies visually.
          </p>
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#6D28D9;">See beyond the code.</p>
          <p style="margin:0;font-size:14px;color:#475569;">— Team Vistra</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export function buildMagicLinkEmail({
  name,
  loginUrl,
  expiresInMinutes,
}: MagicLinkEmailTemplateInput): EmailMessage {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(loginUrl);
  const subject = 'Your Vistra sign-in link';

  const text = [
    `Hi ${name},`,
    '',
    'Use the secure single-use link below to sign in to your Vistra account:',
    '',
    loginUrl,
    '',
    `This link expires in ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not request this sign-in link, you can safely ignore this email.',
    '',
    'See beyond the code.',
    '',
    '— Team Vistra',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:32px 16px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F0F1A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px 16px;border-bottom:1px solid #F1F5F9;">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.4px;color:#0F0F1A;">
            <span style="color:#6D28D9;">V</span>istra
          </div>
          <div style="font-size:12px;color:#64748B;margin-top:2px;">See beyond the code.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${safeName},</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155;">
            Click the button below to sign in securely to Vistra. No password is needed.
          </p>
          <div style="margin:0 0 22px;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#6D28D9;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">
              Sign in to Vistra
            </a>
          </div>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#64748B;">
            This link expires in ${expiresInMinutes} minutes and can only be used once. If the button does not work, copy and paste this URL into your browser:
          </p>
          <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;color:#6D28D9;">
            ${safeUrl}
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#64748B;">
            If you did not request this link, you can safely ignore this email.
          </p>
          <p style="margin:16px 0 4px;font-size:14px;font-weight:600;color:#6D28D9;">See beyond the code.</p>
          <p style="margin:0;font-size:14px;color:#475569;">— Team Vistra</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
