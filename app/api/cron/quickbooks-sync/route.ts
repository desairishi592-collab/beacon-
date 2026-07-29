import { NextResponse, type NextRequest } from 'next/server'
import { syncAllQuickbooksConnections } from '@/lib/quickbooks/sync'

// Fans out over every connected profile, each pulling several months of
// reports from QuickBooks — comfortably longer than the platform default.
export const maxDuration = 300

// Invoked daily by Vercel Cron (see vercel.json's `crons` entry). Vercel
// automatically sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
// requests once CRON_SECRET is set as a project env var — checking it here
// stops this endpoint from being usable by anyone who finds the URL to
// trigger a sync (and the QuickBooks API calls it makes) for every
// connected profile.
//
// Each profile's sync result is recorded in quickbooks_sync_runs regardless
// of outcome (see lib/quickbooks/sync.ts), and one profile's failure never
// stops the others from syncing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await syncAllQuickbooksConnections(request.nextUrl.origin)
  const failed = results.filter((r) => r.error)

  if (failed.length > 0) {
    console.error(`QuickBooks cron sync: ${failed.length}/${results.length} profile(s) failed`, failed)
  }

  return NextResponse.json({
    total: results.length,
    succeeded: results.length - failed.length,
    failed: failed.length,
    results,
  })
}
