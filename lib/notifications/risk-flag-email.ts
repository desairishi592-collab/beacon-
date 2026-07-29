import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { escapeHtml } from './html'
import type { RiskFlag, RiskSeverity } from '@/lib/supabase/types'

// Two-tier split, same as app/dashboard/risk-flags/page.tsx: critical/high are
// "urgent" enough to page someone by email, medium/low stay dashboard-only.
const URGENT_SEVERITIES: RiskSeverity[] = ['critical', 'high']
const SEVERITY_RANK: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function severityColor(severity: RiskSeverity): string {
  return URGENT_SEVERITIES.includes(severity) ? '#c92b25' : '#8a6d00'
}

function flagListHtml(flags: RiskFlag[]): string {
  return [...flags]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .map(
      (flag) => `<li style="margin:0 0 14px;font-size:14px;line-height:1.5;">
        <span style="color:${severityColor(flag.severity)};font-weight:600;">${escapeHtml(flag.severity.toUpperCase())}</span>
        — <strong>${escapeHtml(flag.title)}</strong>
        <div style="color:#555;margin-top:2px;">${escapeHtml(flag.explanation)}</div>
      </li>`
    )
    .join('')
}

async function sendEmail(
  sendgridKey: string,
  fromEmail: string,
  email: string,
  flags: RiskFlag[],
  dashboardUrl: string
): Promise<void> {
  const urgentCount = flags.filter((flag) => URGENT_SEVERITIES.includes(flag.severity)).length
  const subject = `${urgentCount} urgent risk flag${urgentCount === 1 ? '' : 's'} on your Beacon dashboard`

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail, name: 'Beacon Alerts' },
      subject,
      content: [
        {
          type: 'text/html',
          value: `<div style="font-family:sans-serif;color:#111;max-width:560px;">
            <h2 style="margin:0 0 12px;">New risk flags from your latest sync</h2>
            <ul style="margin:0 0 20px;padding-left:18px;">${flagListHtml(flags)}</ul>
            <a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">View on dashboard</a>
          </div>`,
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`SendGrid send failed with status ${res.status}: ${await res.text()}`)
  }
}

// Best-effort notification layered on top of the risk_flags rows that
// analyzeSnapshot already persisted — those are the source of truth, so a
// failure here is logged, not thrown. Only fires when at least one of the
// newly inserted flags is critical/high, and sends one email summarizing all
// of them (not one per flag), regardless of how many flags were created in
// this analysis run.
export async function notifyNewRiskFlags(flags: RiskFlag[], origin: string): Promise<void> {
  if (flags.length === 0) return
  if (!flags.some((flag) => URGENT_SEVERITIES.includes(flag.severity))) return

  const sendgridKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!sendgridKey || !fromEmail) return

  const profileId = flags[0].profile_id

  try {
    const db = createAdminClient()
    const { data, error } = await db.auth.admin.getUserById(profileId)
    if (error || !data.user?.email) return

    const dashboardUrl = new URL('/dashboard/risk-flags', origin).toString()
    await sendEmail(sendgridKey, fromEmail, data.user.email, flags, dashboardUrl)
  } catch (error) {
    console.error(`Risk flag notification email failed for profile ${profileId}:`, error)
  }
}
