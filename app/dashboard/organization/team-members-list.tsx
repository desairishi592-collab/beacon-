'use client'

import { useState } from 'react'
import type { TeamRole } from '@/lib/supabase/types'
import { ConfirmActionButton } from '../_components/confirm-action-button'
import { removeTeamMember } from './actions'

type TeamMember = {
  id: string
  name: string
  role: string
  team_role: TeamRole
}

export function TeamMembersList({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim().toLowerCase()
  const filtered = trimmed
    ? members.filter((member) => member.name.toLowerCase().includes(trimmed))
    : members

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search members by name…"
        aria-label="Search members by name"
        className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
      />

      {filtered.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {filtered.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
            >
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{member.role}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {member.team_role}
                </span>
                <ConfirmActionButton
                  action={removeTeamMember}
                  hiddenField={{ name: 'member_id', value: member.id }}
                  label="Remove"
                  confirmLabel="Confirm remove"
                  pendingLabel="Removing…"
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          No members match &quot;{query}&quot;.
        </p>
      )}
    </>
  )
}
