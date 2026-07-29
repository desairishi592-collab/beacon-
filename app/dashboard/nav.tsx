'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import type { Field } from '@/lib/supabase/types'

export function DashboardNav({ field }: { field?: Field }) {
  const pathname = usePathname()

  // Finance has a real data integration (QuickBooks); other fields get the
  // manual check-in placeholder instead until theirs is built.
  const links =
    field && isManualCheckinField(field)
      ? [
          { href: '/dashboard', label: 'Home' },
          { href: '/dashboard/check-in', label: 'Check-in' },
          { href: '/dashboard/check-in/history', label: 'History' },
          { href: '/dashboard/settings', label: 'Settings' },
        ]
      : [
          { href: '/dashboard', label: 'Home' },
          { href: '/dashboard/integrations', label: 'Integrations' },
          { href: '/dashboard/risk-flags', label: 'Risk flags' },
          { href: '/dashboard/alerts', label: 'Alerts' },
          { href: '/dashboard/settings', label: 'Settings' },
        ]

  return (
    <nav className="w-48 shrink-0 space-y-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            pathname === link.href
              ? 'block rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900'
              : 'block rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
