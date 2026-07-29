'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/risk-flags', label: 'Risk flags' },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="w-48 shrink-0 space-y-1">
      {LINKS.map((link) => (
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
