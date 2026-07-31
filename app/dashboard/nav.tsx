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
  // schedule-upload/manual check-in path plus their own risk flags instead.
  const links: { href: string; label: string; badge?: number }[] =
    field && isManualCheckinField(field)
      ? [
          { href: '/dashboard', label: 'Home' },
          { href: '/dashboard/check-in', label: 'Check-in' },
          { href: '/dashboard/check-in/history', label: 'History' },
          { href: '/dashboard/risk-flags', label: 'Risk flags' },
          ...(isTeamAdmin
            ? [
                { href: '/dashboard/team', label: 'Team' },
                { href: '/dashboard/organization', label: 'Organization' },
              ]
            : []),
          { href: '/dashboard/settings', label: 'Settings' },
        ]
      : [
          { href: '/dashboard', label: 'Home' },
          { href: '/dashboard/risk-flags', label: 'Risk flags' },
          { href: '/dashboard/alerts', label: 'Alerts', badge: unreadAlertCount },
          ...(isTeamAdmin
            ? [
                { href: '/dashboard/team', label: 'Team' },
                { href: '/dashboard/organization', label: 'Organization' },
              ]
            : []),
          { href: '/dashboard/settings', label: 'Settings' },
        ]

  return (
    <nav className="-mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:w-48 md:flex-col md:space-y-1 md:overflow-visible md:px-0 md:pb-0">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
          className={
            pathname === link.href
              ? 'flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-md bg-field-1 px-3 py-2 text-sm font-medium text-field-1-fg'
              : 'flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
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
