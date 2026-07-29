import 'server-only'
import type { CurrentSession } from '@/lib/current-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardSummary, type DashboardSummary, type OverallStatus } from '@/lib/dashboard/summary'
import { daysSince } from '@/lib/dashboard/format'
import { escapeHtml } from './html'

// Same two labels as STATUS_COPY in dashboard-summary.tsx / STATUS_LABEL
// in summary-text.ts, redefined here since neither is exported for reuse.
const STATUS_LABEL: Record<OverallStatus, string> = {
  healthy: 'Healthy',
  needs_attention: 'Needs attention',
}

const STATUS_COLOR: Record<OverallStatus, string> = {
  healthy: '#15803d',
  needs_attention: '#b45309',
}

// Mirrors buildDashboardSummaryText (lib/dashboard/summary-text.ts) but as
// inline-styled HTML for email, following the hand-built-markup convention
// of every other module in lib/notifications.
function digestHtml(summary: DashboardSummary, dashboardUrl: string): string {
  const days = daysSince(summary.lastActivityAt)

  const urgentBlock = summary.isCheckInOverdue
    ? `<div style="margin:16px 0;padding:12px 14px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#991b1b;">Check-in overdue</p>
        <p style="margin:4px 0 0;font-size:13px;color:#7f1d1d;">${escapeHtml(
          days === null
            ? 'No check-in has been submitted yet.'
            : `It's been ${days} day${days === 1 ? '' : 's'} since the last check-in.`,
        )}</p>
      </div>`
    : ''

  return `<div style="font-family:sans-serif;color:#111;max-width:560px;">
    <h2 style="margin:0 0 12px;">Your weekly Beacon status</h2>
    <p style="margin:0 0 6px;font-size:14px;">Overall status: <strong style="color:${STATUS_COLOR[summary.overallStatus]};">${STATUS_LABEL[summary.overallStatus]}</strong></p>
    <p style="margin:0;font-size:14px;color:#555;">Days since last check-in: ${days === null ? 'Never' : days}</p>
    ${urgentBlock}
    <a href="${dashboardUrl}" style="display:inline-block;margin-top:16px;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">View dashboard</a>
  </div>`
}

async function sendDigestEmail(
  sendgridKey: string,
  fromEmail: string,
  email: string,
  summary: DashboardSummary,
  dashboardUrl: string,
): Promise<void> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail, name: 'Beacon Alerts' },
      subject: `Your weekly Beacon digest: ${STATUS_LABEL[summary.overallStatus]}`,
      content: [{ type: 'text/html', value: digestHtml(summary, dashboardUrl) }],
    }),
  })

  if (!res.ok) {
    throw new Error(`SendGrid send failed with status ${res.status}: ${await res.text()}`)
  }
}

// Mirrors vercel.json's `0 14 * * 1` cron schedule for this route — Mondays
// at 14:00 UTC. Pure display helper for the settings page; the actual
// trigger lives in Vercel Cron, not here.
export function getNextWeeklyDigestAt(now: Date = new Date()): Date {
  const next = new Date(now)
  next.setUTCHours(14, 0, 0, 0)
  let daysUntilMonday = (1 - next.getUTCDay() + 7) % 7
  if (daysUntilMonday === 0 && next.getTime() <= now.getTime()) {
    daysUntilMonday = 7
  }
  next.setUTCDate(next.getUTCDate() + daysUntilMonday)
  return next
}

export type WeeklyDigestResult = {
  profileId: string
  sent: boolean
  error: string | null
}

// Weekly digest of the same status a profile sees on their dashboard
// (overall status, days since last check-in, urgency indicator) — reuses
// getDashboardSummary (lib/dashboard/summary.ts) as the single source of
// truth rather than re-deriving it. Skips profiles that opted out via
// weekly_digest_enabled (app/dashboard/settings). One profile at a time,
// same fan-out shape as sendOverdueCheckinReminders: one failure (no email
// on file, a transient SendGrid error) never stops the rest. Silently
// no-ops if SendGrid isn't configured.
export async function sendWeeklyDigests(origin: string): Promise<WeeklyDigestResult[]> {
  const sendgridKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!sendgridKey || !fromEmail) return []

  const db = createAdminClient()
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id')
    .eq('weekly_digest_enabled', true)
  if (error) throw error

  const dashboardUrl = new URL('/dashboard', origin).toString()

  const results: WeeklyDigestResult[] = []
  for (const profile of profiles ?? []) {
    try {
      const { data: userData, error: userError } = await db.auth.admin.getUserById(profile.id)
      if (userError || !userData.user?.email) {
        results.push({ profileId: profile.id, sent: false, error: userError?.message ?? 'No email on file' })
        continue
      }

      // getDashboardSummary only ever scopes queries through
      // .eq('profile_id', session.userId) — the admin client stands in
      // fine here for the per-request RLS client it's normally called
      // with from a signed-in session.
      const session: CurrentSession = { userId: profile.id, db }
      const summary = await getDashboardSummary(session)

      await sendDigestEmail(sendgridKey, fromEmail, userData.user.email, summary, dashboardUrl)
      results.push({ profileId: profile.id, sent: true, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Digest send failed.'
      console.error(`Weekly digest failed for profile ${profile.id}:`, err)
      results.push({ profileId: profile.id, sent: false, error: message })
    }
  }

  return results
}
