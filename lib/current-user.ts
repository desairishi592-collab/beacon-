import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase/server'
import { DEV_AUTH_BYPASS, getDevSession } from './dev-auth'
import type { Database } from './supabase/types'

export type CurrentSession = {
  userId: string
  db: SupabaseClient<Database>
}

// Resolves the current user for server components/actions/routes: the real
// Supabase session, or — while DEV_AUTH_BYPASS is set — the fixed dev user.
// See lib/dev-auth.ts for why the bypass needs a service-role client.
export async function getCurrentSession(): Promise<CurrentSession | null> {
  if (DEV_AUTH_BYPASS) {
    return getDevSession()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return { userId: user.id, db: supabase }
}
