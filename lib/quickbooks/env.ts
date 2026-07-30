import { requireEnv } from '@/lib/env'

export function getQuickbooksClientId(): string {
  return requireEnv('QUICKBOOKS_CLIENT_ID')
}

export function getQuickbooksClientSecret(): string {
  return requireEnv('QUICKBOOKS_CLIENT_SECRET')
}

export function getQuickbooksRedirectUri(): string {
  return requireEnv('QUICKBOOKS_REDIRECT_URI')
}

// 'sandbox' (default) or 'production' — selects the Accounting API host.
// OAuth endpoints are the same for both.
export function getQuickbooksEnvironment(): 'sandbox' | 'production' {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'production' : 'sandbox'
}

export function getQuickbooksApiBaseUrl(): string {
  return getQuickbooksEnvironment() === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}
