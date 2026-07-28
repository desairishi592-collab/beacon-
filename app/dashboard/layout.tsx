import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Beacon</span>
          <div className="flex items-center gap-4">
            {profile?.name && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{profile.name}</span>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <nav className="w-48 shrink-0 space-y-1">
          <span className="block rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Home
          </span>
          <span className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-400 dark:text-neutral-600">
            Integrations
            <span className="text-xs">Soon</span>
          </span>
          <span className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-400 dark:text-neutral-600">
            Risk flags
            <span className="text-xs">Soon</span>
          </span>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
