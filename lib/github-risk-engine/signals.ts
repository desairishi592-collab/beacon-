import type { EngineeringSnapshot } from '@/lib/supabase/types'
import type { RiskSignal, SnapshotPair } from './types'

// Stale PR thresholds, in days since the oldest open PR was created.
const STALE_PR_MEDIUM_DAYS = 7
const STALE_PR_HIGH_DAYS = 14
const STALE_PR_CRITICAL_DAYS = 30

// Unresolved critical issue thresholds, in days since the oldest matching
// open issue (labeled bug/critical/security/vulnerability) was created.
const CRITICAL_ISSUE_MEDIUM_DAYS = 7
const CRITICAL_ISSUE_HIGH_DAYS = 14
const CRITICAL_ISSUE_CRITICAL_DAYS = 30

// Deploy frequency thresholds, as a period-over-period drop in 30-day
// commit count to the default branch — a proxy for deploy frequency, since
// most GitHub-hosted teams ship close to what merges to their default
// branch and GitHub's Deployments API is inconsistently populated across
// repos (many never call it at all).
const COMMIT_DROP_MEDIUM = 0.3
const COMMIT_DROP_HIGH = 0.5
const COMMIT_DROP_CRITICAL = 0.75

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null
  return (current - prior) / prior
}

function computeStalePullRequestsSignal(current: EngineeringSnapshot): RiskSignal | null {
  if (current.open_pr_count === 0 || current.oldest_open_pr_days === null) return null

  const days = current.oldest_open_pr_days
  const severity =
    days >= STALE_PR_CRITICAL_DAYS
      ? 'critical'
      : days >= STALE_PR_HIGH_DAYS
        ? 'high'
        : days >= STALE_PR_MEDIUM_DAYS
          ? 'medium'
          : null
  if (!severity) return null

  return {
    type: 'stale_pull_requests',
    severity,
    metricValue: days,
    thresholdValue: STALE_PR_MEDIUM_DAYS,
    metricLabel: 'stale_pull_requests:oldest_age',
    context: {
      open_pr_count: current.open_pr_count,
      oldest_pr_number: current.oldest_open_pr_number ?? '',
      oldest_pr_title: current.oldest_open_pr_title ?? '',
      oldest_pr_age_days: Math.round(days),
    },
  }
}

function computeUnresolvedCriticalIssuesSignal(current: EngineeringSnapshot): RiskSignal | null {
  if (current.open_critical_issue_count === 0 || current.oldest_critical_issue_days === null) return null

  const days = current.oldest_critical_issue_days
  const severity =
    days >= CRITICAL_ISSUE_CRITICAL_DAYS
      ? 'critical'
      : days >= CRITICAL_ISSUE_HIGH_DAYS
        ? 'high'
        : days >= CRITICAL_ISSUE_MEDIUM_DAYS
          ? 'medium'
          : null
  if (!severity) return null

  return {
    type: 'unresolved_critical_issues',
    severity,
    metricValue: days,
    thresholdValue: CRITICAL_ISSUE_MEDIUM_DAYS,
    metricLabel: 'unresolved_critical_issues:oldest_age',
    context: {
      open_critical_issue_count: current.open_critical_issue_count,
      oldest_issue_number: current.oldest_critical_issue_number ?? '',
      oldest_issue_title: current.oldest_critical_issue_title ?? '',
      oldest_issue_age_days: Math.round(days),
    },
  }
}

function computeDeployFrequencyDropSignal(
  current: EngineeringSnapshot,
  prior: EngineeringSnapshot | null
): RiskSignal | null {
  if (!prior) return null // no baseline to compare against yet

  const change = pctChange(current.commits_last_30_days, prior.commits_last_30_days)
  if (change === null || change >= 0) return null // flat or increased — not a risk

  const drop = Math.abs(change)
  const severity =
    drop >= COMMIT_DROP_CRITICAL
      ? 'critical'
      : drop >= COMMIT_DROP_HIGH
        ? 'high'
        : drop >= COMMIT_DROP_MEDIUM
          ? 'medium'
          : null
  if (!severity) return null

  return {
    type: 'deploy_frequency_drop',
    severity,
    metricValue: change,
    thresholdValue: -COMMIT_DROP_MEDIUM,
    metricLabel: 'deploy_frequency_drop:commits_last_30_days',
    context: {
      current_commits: current.commits_last_30_days,
      prior_commits: prior.commits_last_30_days,
    },
  }
}

// Computes every flagged risk signal for an engineering snapshot. Only
// signals that cross a threshold are returned — this is the "flagging"
// step; plain-language explanation happens separately (see ./explain.ts).
export function computeEngineeringRiskSignals({ current, prior }: SnapshotPair): RiskSignal[] {
  return [
    computeStalePullRequestsSignal(current),
    computeUnresolvedCriticalIssuesSignal(current),
    computeDeployFrequencyDropSignal(current, prior),
  ].filter((signal): signal is RiskSignal => signal !== null)
}
