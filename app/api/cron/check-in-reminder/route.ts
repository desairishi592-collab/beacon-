import { NextResponse, type NextRequest } from 'next/server'
import { sendOverdueCheckinReminders } from '@/lib/notifications/check-in-reminder'

// Invoked weekly by Vercel Cron (see vercel.json's `crons` entry). Same
// Bearer $CRON_SECRET auth as /api/cron/quickbooks-sync — see that route
// for why an unguarded cron endpoint is a problem.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await sendOverdueCheckinReminders(request.nextUrl.origin)
  const sent = results.filter((r) => r.sent).length
  const failed = results.filter((r) => r.error).length

  if (failed > 0) {
    console.error(
      `Check-in reminder cron: ${failed}/${results.length} profile(s) failed`,
      results.filter((r) => r.error)
    )
  }

  return NextResponse.json({ total: results.length, sent, failed, results })
}
