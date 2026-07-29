import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const FEATURES = [
  {
    title: 'Weekly check-ins',
    description:
      'A few quick questions on patient safety, staffing, compliance, and supplies — answer them periodically so there\'s always a current signal to track.',
  },
  {
    title: 'One dashboard summary',
    description:
      'An at-a-glance status (Healthy or Needs attention) and days since your last check-in, with an urgent banner when a check-in is overdue.',
  },
  {
    title: 'Severity trends & recurring risk areas',
    description:
      'See how your overall severity has moved over time and which questions keep coming back as a concern.',
  },
  {
    title: 'Team invites & oversight',
    description:
      "Invite teammates by email and track pending invites. Admins get a Team view of everyone's check-in activity.",
  },
  {
    title: 'CSV exports',
    description:
      'Download your check-in history or a full team overview, ready to drop into a spreadsheet.',
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
            Risk monitoring for medical middle managers
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500 dark:text-neutral-400">
            Charge nurses, clinical directors, and department leads use Beacon to keep a running
            check on their unit — lightweight weekly check-ins and one dashboard that tells you
            what needs attention today.
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
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Overall status</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">Healthy</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Days since last check-in</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">1</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-6 pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Everything you need to stay ahead of risk on your unit
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
              A short onboarding walks you through your name, role, and team size, then it&apos;s
              straight to your dashboard.
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
          Beacon — risk monitoring for medical middle managers.
        </div>
      </footer>
    </div>
  )
}
