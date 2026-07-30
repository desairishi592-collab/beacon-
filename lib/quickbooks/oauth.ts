import 'server-only'
import { getQuickbooksClientId, getQuickbooksClientSecret, getQuickbooksRedirectUri } from './env'

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const ACCOUNTING_SCOPE = 'com.intuit.quickbooks.accounting'

// CSRF nonce cookie name for the OAuth round trip between
// app/api/quickbooks/connect and app/api/quickbooks/callback.
export const QUICKBOOKS_OAUTH_STATE_COOKIE = 'qb_oauth_state'

export type QuickbooksTokens = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
}

export function getQuickbooksAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getQuickbooksClientId(),
    response_type: 'code',
    scope: ACCOUNTING_SCOPE,
    redirect_uri: getQuickbooksRedirectUri(),
    state,
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

function basicAuthHeader(): string {
  const credentials = `${getQuickbooksClientId()}:${getQuickbooksClientSecret()}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
}

function toTokens(response: TokenResponse): QuickbooksTokens {
  const now = Date.now()
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    accessTokenExpiresAt: new Date(now + response.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + response.x_refresh_token_expires_in * 1000),
  }
}

async function requestTokens(body: URLSearchParams): Promise<QuickbooksTokens> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`QuickBooks token request failed (${response.status}): ${detail}`)
  }

  return toTokens((await response.json()) as TokenResponse)
}

export async function exchangeCodeForTokens(code: string): Promise<QuickbooksTokens> {
  return requestTokens(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getQuickbooksRedirectUri(),
    })
  )
}

export async function refreshQuickbooksTokens(refreshToken: string): Promise<QuickbooksTokens> {
  return requestTokens(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  )
}
