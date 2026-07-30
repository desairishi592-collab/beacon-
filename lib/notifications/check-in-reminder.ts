import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// How long a profile can go without a check-in before the weekly cron
// nudges them again. Matches the "e.g. weekly" cadence suggested on
// app/dashboard/check-in/page.tsx.
const REMINDER_INTERVAL_DAYS = 7

async function sendReminderEmail(
  sendgridKey: string,
  fromEmail: string,
  email: string,
  dashboardUrl: string
): Promise<void> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail, name: 'Beacon Alerts' },
      subject: 'Your Beacon check-in is due',
      content: [
        {
          type: 'text/html',
          value: `<div style="font-family:sans-serif;color:#111;max-width:560px;">
            <h2 style="margin:0 0 12px;">Time for your check-in</h2>
            <p style="margin:0 0 16px;color:#555;font-size:14px;">It's been a week or more since your last Beacon check-in. A couple minutes now keeps a risk signal flowing for your field.</p>
            <a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px;">Submit check-in</a>
          </div>`,
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`SendGrid send failed with status ${res.status}: ${await res.text()}`)
  }
}

export type CheckinReminderResult = {
  profileId: string
  sent: boolean
  error: string | null
}

// Reminds every non-Finance profile (Finance gets automated QuickBooks
// monitoring instead — see lib/quickbooks) that hasn't submitted a
// manual_checkins row in REMINDER_INTERVAL_DAYS. One profile at a time, so
// one failure (no email on file, a transient SendGrid error) doesn't stop
// the rest — same fan-out shape as syncAllQuickbooksConnections. Silently
// no-ops if SendGrid isn't configured, same as notifyNewRiskFlags. Skips
// profiles that opted out via check_in_reminder_enabled (app/dashboard/settings),
// same convention as weekly_digest_enabled in sendWeeklyDigests.
export async function sendOverdueCheckinReminders(origin: string): Promise<CheckinReminderResult[]> {
  const sendgridKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!sendgridKey || !fromEmail) return []

  const db = createAdminClient()
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id')
    .neq('field', 'finance')
    .eq('check_in_reminder_enabled', true)
  if (error) throw error

  const dashboardUrl = new URL('/dashboard/check-in', origin).toString()
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000)

  const results: CheckinReminderResult[] = []
  for (const { id: profileId } of profiles ?? []) {
    try {
      const { data: latest } = await db
        .from('manual_checkins')
        .select('created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const overdue = !latest || new Date(latest.created_at) < cutoff
      if (!overdue) {
        results.push({ profileId, sent: false, error: null })
        continue
      }

      const { data: userData, error: userError } = await db.auth.admin.getUserById(profileId)
      if (userError || !userData.user?.email) {
        results.push({ profileId, sent: false, error: userError?.message ?? 'No email on file' })
        continue
      }

      await sendReminderEmail(sendgridKey, fromEmail, userData.user.email, dashboardUrl)
      results.push({ profileId, sent: true, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reminder send failed.'
      console.error(`Check-in reminder failed for profile ${profileId}:`, err)
      results.push({ profileId, sent: false, error: message })
    }
  }

  return results
}
