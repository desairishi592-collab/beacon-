import type { TeamRole } from '@/lib/supabase/types'

// One row per team member, mirroring DashboardSummary's lastActivityLabel
// (lib/dashboard/summary.ts): manual check-in recency and severity trend.
export type TeamOverviewRow = {
  name: string
  role: string
  teamRole: TeamRole
  lastCheckInAt: string | null
  trendDelta: number | null
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Never'
}

// Same delta bands as TrendIndicator (app/dashboard/_components/check-in-trends.tsx).
function trendLabel(delta: number | null): string {
  if (delta === null) return 'Not enough data yet'
  if (Math.abs(delta) < 0.25) return 'Steady'
  return delta < 0 ? 'Improving' : 'Worsening'
}

export function buildTeamOverviewCsv(rows: TeamOverviewRow[]): string {
  const header = ['Name', 'Role', 'Team Role', 'Last Check-in', 'Severity Trend']

  const body = rows.map((row) => {
    const teamRoleLabel = row.teamRole === 'admin' ? 'Admin' : 'Member'
    return [row.name, row.role, teamRoleLabel, formatDate(row.lastCheckInAt), trendLabel(row.trendDelta)]
  })

  return [header, ...body].map((row) => row.map(csvField).join(',')).join('\r\n')
}
