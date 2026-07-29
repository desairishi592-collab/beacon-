import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEV_AUTH_BYPASS } from '@/lib/dev-auth'

export default async function RootPage() {
  // TEMPORARY DEV-ONLY: skip the real session check. proxy.ts's own bypass
  // resolves whether this lands on /dashboard or /onboarding. See lib/dev-auth.ts.
  if (DEV_AUTH_BYPASS) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  redirect(user ? '/dashboard' : '/login')
}
