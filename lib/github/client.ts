import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { GithubConnection } from '@/lib/supabase/types'

const GITHUB_API_BASE_URL = 'https://api.github.com'

export async function getGithubConnection(profileId: string): Promise<GithubConnection | null> {
  const db = createAdminClient()
  const { data, error } = await db.from('github_connections').select('*').eq('profile_id', profileId).maybeSingle()
  if (error) throw error
  return data
}

// The only HTTP method this module exposes for calling GitHub's API. There
// is deliberately no POST/PATCH/PUT/DELETE helper anywhere in this file —
// the sync job (lib/github/sync.ts) has no way to write to a connected
// repository even if it tried. Read-only access is also enforced by GitHub
// itself: connect (lib/github/validate.ts) requires a fine-grained PAT the
// user scoped to Contents/Issues/Pull requests/Metadata = Read-only, and
// GitHub rejects write calls made with such a token regardless of what this
// app does.
export async function githubApiGet(
  accessToken: string,
  path: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const url = new URL(`${GITHUB_API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`GitHub API request to "${path}" failed (${response.status}): ${detail}`)
  }

  return response.json()
}
