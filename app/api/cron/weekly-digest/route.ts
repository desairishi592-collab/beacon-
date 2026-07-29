import { NextResponse, type NextRequest } from 'next/server'
import { sendWeeklyDigests } from '@/lib/notifications/weekly-digest'

// Invoked weekly by Vercel Cron (see vercel.json's `crons` entry), gated
// behind a Bearer $CRON_SECRET so the endpoint can't be triggered by anyone
// who finds the URL.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await sendWeeklyDigests(request.nextUrl.origin)
  const sent = results.filter((r) => r.sent).length
  const failed = results.filter((r) => r.error).length

  if (failed > 0) {
    console.error(`Weekly digest cron: ${failed}/${results.length} profile(s) failed`, results.filter((r) => r.error))
  }

  return NextResponse.json({ total: results.length, sent, failed, results })
}
