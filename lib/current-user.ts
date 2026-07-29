import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase/server'
import type { Database } from './supabase/types'

export type CurrentSession = {
  userId: string
  db: SupabaseClient<Database>
}

// Resolves the current user for server components/actions/routes from the
// real Supabase session.
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  return { userId: user.id, db: supabase }
}
