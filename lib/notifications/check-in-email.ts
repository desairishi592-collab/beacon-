import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { escapeHtml } from './html'
import { getCheckInQuestions, RATING_SCALE } from '@/lib/check-ins/questions'

// Same threshold as the "Significant"/"Severe" labels in RATING_SCALE.
const SEVERE_RATING_THRESHOLD = 4
const RATING_LABEL = new Map<number, string>(RATING_SCALE.map((r) => [r.value, r.label]))

type SubmittedCheckin = {
  profileId: string
  responses: Record<string, number>
  notes: string | null
}

async function sendEmail(
  sendgridKey: string,
  fromEmail: string,
  email: string,
  severeItems: { prompt: string; rating: number }[],
  notes: string | null,
  dashboardUrl: string
): Promise<void> {
  const subject = `${severeItems.length} concern${severeItems.length === 1 ? '' : 's'} flagged in your latest check-in`

  const itemsHtml = severeItems
    .map(
      (item) => `<li style="margin:0 0 10px;font-size:14px;line-height:1.5;">
        <span style="color:#c92b25;font-weight:600;">${escapeHtml(RATING_LABEL.get(item.rating) ?? String(item.rating))}</span>
        — ${escapeHtml(item.prompt)}
      </li>`
    )
    .join('')

  const notesHtml = notes
    ? `<p style="margin:0 0 20px;color:#555;font-size:14px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>`
    : ''

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
            <h2 style="margin:0 0 12px;">Your check-in flagged some concerns</h2>
            <ul style="margin:0 0 16px;padding-left:18px;">${itemsHtml}</ul>
            ${notesHtml}
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

// Best-effort notification layered on top of the manual_checkins row that
// submitCheckIn already persisted — that row is the source of truth, so a
// failure here is logged, not thrown. Only fires when at least one answer
// rates Significant/Severe (4/5); unlike risk flags there's no automated
// analysis of check-ins, so this is a plain threshold on the raw ratings.
export async function notifySevereCheckin(checkin: SubmittedCheckin, origin: string): Promise<void> {
  const questions = getCheckInQuestions()
  const severeItems = questions
    .map((question) => ({ prompt: question.prompt, rating: checkin.responses[question.id] }))
    .filter((item): item is { prompt: string; rating: number } => item.rating >= SEVERE_RATING_THRESHOLD)

  if (severeItems.length === 0) return

  const sendgridKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!sendgridKey || !fromEmail) return

  try {
    const db = createAdminClient()
    const { data, error } = await db.auth.admin.getUserById(checkin.profileId)
    if (error || !data.user?.email) return

    const dashboardUrl = new URL('/dashboard/check-in', origin).toString()
    await sendEmail(sendgridKey, fromEmail, data.user.email, severeItems, checkin.notes, dashboardUrl)
  } catch (error) {
    console.error(`Check-in severity notification email failed for profile ${checkin.profileId}:`, error)
  }
}
