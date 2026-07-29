import 'server-only'
import { createAdminClient } from './supabase/admin'

/**
 * TEMPORARY DEV-ONLY AUTH BYPASS.
 *
 * Set DEV_AUTH_BYPASS=true in .env.local to skip real Supabase login and
 * act everywhere (proxy.ts, dashboard layout/page, onboarding) as a fixed
 * local test user. This exists so QuickBooks + risk-analysis work can be
 * built and tested while real login is broken.
 *
 * DELETE this file and every `DEV_AUTH_BYPASS` branch that reads it before
 * this app goes anywhere near real users — it removes login entirely.
 */
export const DEV_AUTH_BYPASS = process.env.DEV_AUTH_BYPASS === 'true'

const DEV_USER_EMAIL = 'dev-bypass@beacon.local'
const DEV_USER_PASSWORD = 'dev-bypass-not-a-real-account-0000'

let cachedDevUserId: string | null = null

// Lazily creates (once) a real auth.users row so tables with a
// `references auth.users(id)` FK — profiles, and whatever QuickBooks/
// analysis tables come next — behave normally for the bypass user.
// Result is cached in memory for the life of the dev server process.
async function getDevUserId(): Promise<string> {
  if (cachedDevUserId) return cachedDevUserId

  const admin = createAdminClient()
  const { data: list, error: listError } = await admin.auth.admin.listUsers()
  if (listError) throw listError

  const existing = list.users.find((u) => u.email === DEV_USER_EMAIL)
  if (existing) {
    cachedDevUserId = existing.id
    return existing.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEV_USER_EMAIL,
    password: DEV_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { dev_bypass: true },
  })
  if (error || !data.user) {
    throw error ?? new Error('DEV_AUTH_BYPASS: failed to create dev bypass user')
  }

  cachedDevUserId = data.user.id
  return data.user.id
}

// Convenience bundle for server components/actions: the bypass user's id
// plus a service-role client (needed since there's no real session for
// RLS to authorize against).
export async function getDevSession() {
  const userId = await getDevUserId()
  return { userId, db: createAdminClient() }
}
