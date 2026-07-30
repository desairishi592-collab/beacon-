import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const FEATURES = [
  {
    title: 'Automated risk flags',
    description:
      'Connect QuickBooks and Beacon watches your synced financials for cash, burn, coverage, and expense risk — flagging anything that crosses a threshold, by severity.',
  },
  {
    title: 'Check-ins for every field',
    description:
      "No integration for your field yet? Answer a few quick, field-specific questions each week — medicine, engineering, and other fields all have their own set — so there's still a signal to track.",
  },
  {
    title: 'One dashboard summary',
    description:
      'An at-a-glance status (Healthy, Needs attention, Critical), open risk flag counts by severity, and days since your last sync or check-in — with an urgent banner when cash runway turns critical or a check-in is overdue.',
  },
  {
    title: 'Alerts you control',
    description:
      'Every risk signal, past and present, in one list. Mark alerts read or dismiss them, and choose which signal types email you — plus an optional weekly digest.',
  },
  {
    title: 'Team invites & oversight',
    description:
      "Invite teammates by email and track pending invites. Admins get a Team view of everyone's check-in activity — financial data and risk flags stay private to each person.",
  },
  {
    title: 'CSV exports',
    description:
      'Download your risk flags (respecting whatever severity filter you have applied) or a full team overview, ready to drop into a spreadsheet.',
  },
]

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Beacon</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Risk monitoring for middle managers
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500 dark:text-neutral-400">
            Beacon keeps a running check on the health of your team — automated financial risk
            detection where an integration exists, lightweight check-ins everywhere else, and one
            dashboard that tells you what needs attention today.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Get started free
            </Link>
            <Link
              href="#features"
              className="rounded-md border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              See what it does
            </Link>
          </div>
          <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-600">
            Sign up with email, Google, or GitHub.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-16">
          <div
            aria-hidden="true"
            className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Dashboard preview
              </p>
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                Healthy
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Overall status</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">Healthy</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Open risk flags</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">2</p>
                <p className="mt-2 text-xs font-medium text-red-400 dark:text-red-300">Medium 2</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Days since last sync</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">1</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-6 pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Everything you need to stay ahead of risk
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto max-w-5xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to see your risk picture?</h2>
            <p className="mx-auto mt-2 max-w-xl text-neutral-500 dark:text-neutral-400">
              A short onboarding walks you through your name, company, role, and field, then asks
              whether we can integrate with your systems — say yes and we&apos;ll connect a data
              source right away, or say no and start with quick manual check-ins instead.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-6 dark:border-neutral-800">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-neutral-400 dark:text-neutral-600">
          Beacon — risk monitoring for middle managers.
        </div>
      </footer>
    </div>
  )
}
