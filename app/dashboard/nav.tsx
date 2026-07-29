'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function DashboardNav({ isTeamAdmin = false }: { isTeamAdmin?: boolean }) {
  const pathname = usePathname()

  const links: { href: string; label: string }[] = [
    { href: '/dashboard', label: 'Home' },
    { href: '/dashboard/check-in', label: 'Check-in' },
    { href: '/dashboard/check-in/history', label: 'History' },
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
              ? 'flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900'
              : 'flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
