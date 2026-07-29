'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isManualCheckinField } from '@/lib/check-ins/questions'
import type { Field } from '@/lib/supabase/types'

function BellIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path strokeLinecap="round" d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function DashboardNav({
  field,
  unreadAlertCount = 0,
  isTeamAdmin = false,
}: {
  field?: Field
  unreadAlertCount?: number
  isTeamAdmin?: boolean
}) {
  const pathname = usePathname()

  // Finance has a real data integration (QuickBooks); other fields get the
  // manual check-in placeholder instead until theirs is built.
  const links: { href: string; label: string; badge?: number }[] =
    field && isManualCheckinField(field)
      ? [
          { href: '/dashboard', label: 'Home' },
          { href: '/dashboard/check-in', label: 'Check-in' },
          { href: '/dashboard/check-in/history', label: 'History' },
          ...(isTeamAdmin ? [{ href: '/dashboard/team', label: 'Team' }] : []),
          { href: '/dashboard/settings', label: 'Settings' },
        ]
      : [
          { href: '/dashboard', label: 'Home' },
          { href: '/dashboard/integrations', label: 'Integrations' },
          { href: '/dashboard/risk-flags', label: 'Risk flags' },
          { href: '/dashboard/alerts', label: 'Alerts', badge: unreadAlertCount },
          ...(isTeamAdmin ? [{ href: '/dashboard/team', label: 'Team' }] : []),
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
              ? 'flex items-center justify-between gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900'
              : 'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
          }
        >
          <span className="flex items-center gap-2">
            {link.badge !== undefined && <BellIcon />}
            {link.label}
          </span>
          {link.badge !== undefined && link.badge > 0 && (
            <span
              aria-label={`${link.badge} unread alert${link.badge === 1 ? '' : 's'}`}
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-medium text-white"
            >
              {link.badge > 99 ? '99+' : link.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
