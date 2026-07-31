import { NextResponse, type NextRequest } from 'next/server'
import { syncAllGithubConnections } from '@/lib/github/sync'

// Fans out over every connected profile, each pulling PRs/issues/commits
// from GitHub and running risk analysis — comfortably longer than the
// platform default. Mirrors app/api/cron/quickbooks-sync/route.ts.
export const maxDuration = 300

// Invoked daily by Vercel Cron (see vercel.json's `crons` entry). Vercel
// automatically sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
// requests once CRON_SECRET is set as a project env var — checking it here
// stops this endpoint from being usable by anyone who finds the URL to
// trigger a sync (and the GitHub API calls it makes, all read-only) for
// every connected profile.
//
// One profile's failure (revoked token, deleted repo, GitHub API downtime)
// never stops the others from syncing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await syncAllGithubConnections()
  const failed = results.filter((r) => r.error)

  if (failed.length > 0) {
    console.error(`GitHub cron sync: ${failed.length}/${results.length} profile(s) failed`, failed)
  }

  return NextResponse.json({
    total: results.length,
    succeeded: results.length - failed.length,
    failed: failed.length,
    results,
  })
}
