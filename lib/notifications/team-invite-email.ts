import 'server-only'
import { escapeHtml } from './html'

type TeamInviteEmail = {
  inviteId: string
  inviteeEmail: string
  inviterName: string
  origin: string
}

// Unlike the check-in/risk-flag notifications, the invite email is the
// whole point of the action that triggers it — a pending invite row with no
// email delivered is useless — so this throws on failure instead of
// swallowing it. The caller (inviteTeamMember) rolls back the invite row
// and surfaces an error when this throws.
export async function sendTeamInviteEmail({
  inviteId,
  inviteeEmail,
  inviterName,
  origin,
}: TeamInviteEmail): Promise<void> {
  const sendgridKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!sendgridKey || !fromEmail) {
    throw new Error('SendGrid is not configured (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL).')
  }

  const signupUrl = new URL('/login', origin)
  signupUrl.searchParams.set('invite', inviteId)
  signupUrl.searchParams.set('email', inviteeEmail)

  const subject = `${inviterName} invited you to join their team on Beacon`

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: inviteeEmail }] }],
      from: { email: fromEmail, name: 'Beacon Alerts' },
      subject,
      content: [
        {
          type: 'text/html',
          value: `<div style="font-family:sans-serif;color:#111;max-width:560px;">
            <h2 style="margin:0 0 12px;">${escapeHtml(inviterName)} invited you to Beacon</h2>
            <p style="margin:0 0 20px;color:#555;font-size:14px;">Beacon helps managers track team and financial risk. Create your account to join ${escapeHtml(inviterName)}'s team.</p>
            <a href="${signupUrl.toString()}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">Accept invite</a>
          </div>`,
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`SendGrid send failed with status ${res.status}: ${await res.text()}`)
  }
}
