import 'server-only'
import { githubApiGet } from './client'

const COMMITS_WINDOW_DAYS = 30
const CRITICAL_ISSUE_LABELS = ['critical', 'bug', 'security', 'vulnerability']
const MAX_COMMIT_PAGES = 10

type GithubPullRequest = {
  number: number
  title: string
  created_at: string
}

type GithubIssue = {
  number: number
  title: string
  created_at: string
  // Present (non-null) on issues that are actually pull requests — the
  // REST issues endpoint returns both. Excluded before we ever see them.
  pull_request?: unknown
}

export type OpenPullRequest = {
  number: number
  title: string
  ageDays: number
}

export type OpenCriticalIssue = {
  number: number
  title: string
  ageDays: number
}

function ageInDays(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
}

// GET /repos/{owner}/{repo} — used both to validate a newly connected
// token/repo pair and to find the default branch for commit history.
export async function fetchRepo(
  accessToken: string,
  owner: string,
  repo: string
): Promise<{ defaultBranch: string }> {
  const data = (await githubApiGet(accessToken, `/repos/${owner}/${repo}`)) as { default_branch: string }
  return { defaultBranch: data.default_branch }
}

export async function fetchOpenPullRequests(
  accessToken: string,
  owner: string,
  repo: string
): Promise<OpenPullRequest[]> {
  const prs = (await githubApiGet(accessToken, `/repos/${owner}/${repo}/pulls`, {
    state: 'open',
    per_page: '100',
    sort: 'created',
    direction: 'asc',
  })) as GithubPullRequest[]

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    ageDays: ageInDays(pr.created_at),
  }))
}

// GitHub does the label matching server-side via the `labels` query param
// below — issues just need PRs (which the same endpoint also returns)
// filtered out.
export async function fetchOpenCriticalIssues(
  accessToken: string,
  owner: string,
  repo: string
): Promise<OpenCriticalIssue[]> {
  const issues = (await githubApiGet(accessToken, `/repos/${owner}/${repo}/issues`, {
    state: 'open',
    labels: CRITICAL_ISSUE_LABELS.join(','),
    per_page: '100',
  })) as GithubIssue[]

  return issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      ageDays: ageInDays(issue.created_at),
    }))
}

// Counts commits to the default branch in the last 30 days, paginating via
// GitHub's `page` param up to MAX_COMMIT_PAGES (1000 commits) as a cost
// bound — more than enough to detect a frequency drop on any repo where
// "deploy frequency" is a meaningful signal in the first place.
export async function fetchRecentCommitCount(
  accessToken: string,
  owner: string,
  repo: string,
  defaultBranch: string
): Promise<number> {
  const since = new Date(Date.now() - COMMITS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let count = 0
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const commits = (await githubApiGet(accessToken, `/repos/${owner}/${repo}/commits`, {
      sha: defaultBranch,
      since,
      per_page: '100',
      page: String(page),
    })) as unknown[]

    count += commits.length
    if (commits.length < 100) break
  }

  return count
}
