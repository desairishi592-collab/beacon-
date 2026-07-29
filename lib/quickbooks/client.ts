import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshQuickbooksTokens } from './oauth'
import { getQuickbooksApiBaseUrl } from './env'
import type { QuickbooksConnection } from '@/lib/supabase/types'

// Refresh a bit before the token actually expires so a request never races
// expiry mid-flight.
const REFRESH_SKEW_MS = 5 * 60 * 1000

export async function getQuickbooksConnection(profileId: string): Promise<QuickbooksConnection | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('quickbooks_connections')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Returns a valid access token for the connection, transparently refreshing
// (and persisting the refreshed tokens) if the current one is expired or
// close to it.
export async function getValidAccessToken(connection: QuickbooksConnection): Promise<string> {
  const expiresAt = new Date(connection.access_token_expires_at).getTime()
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return connection.access_token
  }

  const tokens = await refreshQuickbooksTokens(connection.refresh_token)
  const db = createAdminClient()
  const { error } = await db
    .from('quickbooks_connections')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      access_token_expires_at: tokens.accessTokenExpiresAt.toISOString(),
      refresh_token_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
    })
    .eq('id', connection.id)
  if (error) throw error

  return tokens.accessToken
}

// GETs a QuickBooks Accounting API endpoint (reports, in practice) for the
// given realm and returns the parsed JSON body.
export async function quickbooksApiGet(
  realmId: string,
  accessToken: string,
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${getQuickbooksApiBaseUrl()}/v3/company/${realmId}/${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`QuickBooks API request to "${path}" failed (${response.status}): ${detail}`)
  }

  return response.json()
}
