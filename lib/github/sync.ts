import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGithubConnection } from './client'
import { fetchOpenCriticalIssues, fetchOpenPullRequests, fetchRecentCommitCount, fetchRepo } from './repos'
import { analyzeEngineeringSnapshot } from '@/lib/github-risk-engine/analyze'
import type { EngineeringRiskFlag } from '@/lib/supabase/types'

export type GithubSyncResult = {
  snapshotId: string
  flagsComputed: number
}

// Pulls open PRs, open critical-labeled issues, and the last 30 days of
// default-branch commits, then inserts one engineering_snapshots row and
// runs risk analysis against it immediately — in-process, unlike
// lib/quickbooks/sync.ts's HTTP round trip to /api/risk-analysis. That
// indirection exists there so other future finance ingestion sources can
// hit the same endpoint without importing risk-engine internals; there's no
// second GitHub-shaped ingestion source to share with here, so the simpler,
// synchronous call (same as lib/schedule-risk-engine and
// lib/checkin-risk-engine) is enough.
export async function syncGithubData(profileId: string): Promise<GithubSyncResult> {
  const db = createAdminClient()
  const connection = await getGithubConnection(profileId)
  if (!connection) {
    throw new Error('GitHub is not connected for this profile.')
  }

  const { repo_owner: owner, repo_name: repo, access_token: accessToken } = connection

  const { defaultBranch } = await fetchRepo(accessToken, owner, repo)
  const [openPrs, criticalIssues, commitsLast30Days] = await Promise.all([
    fetchOpenPullRequests(accessToken, owner, repo),
    fetchOpenCriticalIssues(accessToken, owner, repo),
    fetchRecentCommitCount(accessToken, owner, repo, defaultBranch),
  ])

  const oldestPr = openPrs[0] ?? null // sorted ascending by created_at
  const oldestIssue = criticalIssues.reduce<(typeof criticalIssues)[number] | null>(
    (oldest, issue) => (oldest === null || issue.ageDays > oldest.ageDays ? issue : oldest),
    null
  )

  const { data: snapshot, error: insertError } = await db
    .from('engineering_snapshots')
    .insert({
      profile_id: profileId,
      open_pr_count: openPrs.length,
      oldest_open_pr_days: oldestPr?.ageDays ?? null,
      oldest_open_pr_number: oldestPr?.number ?? null,
      oldest_open_pr_title: oldestPr?.title ?? null,
      open_critical_issue_count: criticalIssues.length,
      oldest_critical_issue_days: oldestIssue?.ageDays ?? null,
      oldest_critical_issue_number: oldestIssue?.number ?? null,
      oldest_critical_issue_title: oldestIssue?.title ?? null,
      commits_last_30_days: commitsLast30Days,
      source: 'github',
    })
    .select('id')
    .single()
  if (insertError) throw insertError

  const { error: touchError } = await db
    .from('github_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', connection.id)
  if (touchError) throw touchError

  let flags: EngineeringRiskFlag[] = []
  try {
    flags = await analyzeEngineeringSnapshot(snapshot.id)
  } catch (error) {
    // Best-effort: a risk-engine failure shouldn't fail the whole sync — the
    // ingested snapshot is still valuable and can be re-analyzed later.
    console.error('Engineering risk analysis failed after GitHub sync:', error)
  }

  return { snapshotId: snapshot.id, flagsComputed: flags.length }
}

export type GithubSyncAllResult = {
  profileId: string
  result: GithubSyncResult | null
  error: string | null
}

// Syncs every connected profile, one at a time, so one profile's failure
// (revoked token, that repo going private/deleted, GitHub API downtime)
// doesn't stop the rest from syncing. Used by the daily cron job.
export async function syncAllGithubConnections(): Promise<GithubSyncAllResult[]> {
  const db = createAdminClient()
  const { data: connections, error } = await db.from('github_connections').select('profile_id')
  if (error) throw error

  const results: GithubSyncAllResult[] = []
  for (const { profile_id: profileId } of connections ?? []) {
    try {
      const result = await syncGithubData(profileId)
      results.push({ profileId, result, error: null })
    } catch (error) {
      console.error(`GitHub sync failed for profile ${profileId}:`, error)
      results.push({
        profileId,
        result: null,
        error: error instanceof Error ? error.message : 'GitHub sync failed.',
      })
    }
  }
  return results
}
