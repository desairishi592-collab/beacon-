import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentSession } from '@/lib/current-user'
import { exchangeCodeForTokens, QUICKBOOKS_OAUTH_STATE_COOKIE } from '@/lib/quickbooks/oauth'
import { syncQuickbooksData } from '@/lib/quickbooks/sync'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const realmId = url.searchParams.get('realmId')
  const expectedState = request.cookies.get(QUICKBOOKS_OAUTH_STATE_COOKIE)?.value

  const failure = (message: string) => {
    const target = new URL('/dashboard/settings/integrations', request.url)
    target.searchParams.set('qb_error', message)
    const response = NextResponse.redirect(target)
    response.cookies.delete(QUICKBOOKS_OAUTH_STATE_COOKIE)
    return response
  }

  if (!code || !realmId) return failure('QuickBooks did not return an authorization code.')
  if (!state || !expectedState || state !== expectedState) {
    return failure('QuickBooks OAuth state mismatch — please try connecting again.')
  }

  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const db = createAdminClient()
    const { error } = await db.from('quickbooks_connections').upsert(
      {
        profile_id: session.userId,
        realm_id: realmId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        access_token_expires_at: tokens.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
      },
      { onConflict: 'profile_id' }
    )
    if (error) throw error
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect QuickBooks.'
    return failure(message)
  }

  // Pull the initial history right away so the dashboard has data as soon as
  // the user lands back on it. Best-effort — a failure here shouldn't make
  // it look like connecting failed; "Sync now" can retry.
  const target = new URL('/dashboard/settings/integrations', request.url)
  target.searchParams.set('connected', '1')
  try {
    await syncQuickbooksData(session.userId, request.nextUrl.origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Initial QuickBooks sync failed.'
    target.searchParams.set('qb_sync_error', message)
  }

  const response = NextResponse.redirect(target)
  response.cookies.delete(QUICKBOOKS_OAUTH_STATE_COOKIE)
  return response
}
